// BLACKSENTINEL AI - Memory routes: real tests against the real route code.
// The pre-existing "Memory Service" describe block in ai-engine.test.ts never
// imported src/server/routes/memory.ts — it asserted a literal object equaled
// itself. This file actually drives the route.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

vi.mock('../../src/server/db', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '../../src/server/db';
import { createMemoryRoutes } from '../../src/server/routes/memory';

const mockedQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/memory',
    (req, _res, next) => {
      (req as any).tenantId = 'test-tenant';
      next();
    },
    createMemoryRoutes()
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/memory`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('POST /api/v1/memory/store', () => {
  it('inserts into memory_entries and returns the stored row', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'm1', type: 'operational', content: 'x', metadata: {}, tenant_id: 'test-tenant', access_count: 0, relevance_score: 1, expires_at: null, created_at: new Date() }],
    });

    const res = await fetch(`${baseUrl}/store`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'lateral movement observed', type: 'operational', tenantId: 'client-supplied-tenant' }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.entry.id).toBe('m1');
    expect(mockedQuery.mock.calls[0][0]).toMatch(/INSERT INTO memory_entries/);
    // the authenticated tenant wins over whatever the client put in the body
    expect(mockedQuery.mock.calls[0][1][3]).toBe('test-tenant');
  });

  it('rejects an invalid memory type before touching the database', async () => {
    const res = await fetch(`${baseUrl}/store`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'x', type: 'not-a-real-type', tenantId: 'test-tenant' }),
    });

    expect(res.status).toBe(500); // zod throws, caught by the route and rethrown to the error handler (none mounted here -> express default 500)
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/memory/retrieve', () => {
  it('runs a lexical search scoped to the tenant and labels the strategy honestly', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'm1', type: 'operational', content: 'lateral movement via PsExec', metadata: {}, tenant_id: 'test-tenant', access_count: 2, relevance_score: 0.9, expires_at: null, created_at: new Date() }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // access_count bump

    const res = await fetch(`${baseUrl}/retrieve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'lateral movement', tenantId: 'test-tenant' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalFound).toBe(1);
    expect(body.matchStrategy).toBe('lexical');
    expect(mockedQuery.mock.calls[0][1][0]).toBe('test-tenant');
    expect(mockedQuery.mock.calls[0][1][1]).toBe('%lateral movement%');
  });
});

describe('GET /api/v1/memory/stats', () => {
  it('aggregates real counts per memory type for the authenticated tenant', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ type: 'operational', count: 4 }, { type: 'incident', count: 1 }] });
    mockedQuery.mockResolvedValueOnce({ rows: [{ total: 5 }] });

    const res = await fetch(`${baseUrl}/stats`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalEntries).toBe(5);
    const operational = body.layers.find((l: any) => l.name === 'operational');
    const immediate = body.layers.find((l: any) => l.name === 'immediate');
    expect(operational.count).toBe(4);
    expect(immediate.count).toBe(0); // real zero, not a fabricated number
  });
});
