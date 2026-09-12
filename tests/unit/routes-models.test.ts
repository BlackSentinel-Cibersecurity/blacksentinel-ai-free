// BLACKSENTINEL AI - Model registry routes: real DB-backed CRUD, not two
// hardcoded fake models returned on every request.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

vi.mock('../../src/server/db', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '../../src/server/db';
import { createModelRoutes } from '../../src/server/routes/models';

const mockedQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/models',
    (req, _res, next) => {
      (req as any).tenantId = 'test-tenant';
      next();
    },
    createModelRoutes()
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/models`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('GET /api/v1/models', () => {
  it('returns real rows scoped to the tenant, not the old hardcoded pair', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await fetch(`${baseUrl}/`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.models).toEqual([]); // no fake "Sentinel LLM" / "Threat Classifier" anymore
    expect(mockedQuery.mock.calls[0][1]).toEqual(['test-tenant']);
  });
});

describe('POST /api/v1/models', () => {
  it('inserts a real row and starts a freshly registered model at zero metrics', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{
        id: 'm1', name: 'Custom Classifier', version: '0.1.0', type: 'classification', provider: 'internal',
        endpoint: 'https://internal/model', capabilities: ['classify'], status: 'inactive',
        metrics: { accuracy: 0, latency: 0, totalRequests: 0 }, tenant_id: 'test-tenant',
        created_at: new Date(), updated_at: new Date(),
      }],
    });

    const res = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom Classifier', version: '0.1.0', type: 'classification', provider: 'internal',
        endpoint: 'https://internal/model', capabilities: ['classify'], tenantId: 'test-tenant',
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.status).toBe('inactive');
    expect(body.metrics.accuracy).toBe(0); // real zero, not a fabricated 0.92
  });
});

describe('POST /api/v1/models/:id/deploy', () => {
  it('flips status to active for a real row', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'm1', name: 'X', version: '1', type: 'llm', provider: 'openai', endpoint: null, capabilities: null, status: 'active', metrics: null, tenant_id: 'test-tenant', created_at: new Date(), updated_at: new Date() }],
    });

    const res = await fetch(`${baseUrl}/m1/deploy`, { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('active');
    expect(mockedQuery.mock.calls[0][0]).toMatch(/UPDATE models SET status = 'active'/);
  });

  it('404s when the model does not exist for this tenant', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    const res = await fetch(`${baseUrl}/does-not-exist/deploy`, { method: 'POST' });
    expect(res.status).toBe(404);
  });
});
