// BLACKSENTINEL AI - Alerts routes: tenant isolation regression test.
// This route used to be mounted with no auth at all and hardcoded
// tenant_id = 'default' in every query — verifies the fix actually scopes
// every query to the authenticated tenant now.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

vi.mock('../../src/server/db', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '../../src/server/db';
import { createAlertRoutes } from '../../src/server/routes/alerts';

const mockedQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/alerts',
    (req, _res, next) => {
      (req as any).tenantId = 'acme-corp';
      next();
    },
    createAlertRoutes()
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/alerts`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('GET /api/v1/alerts', () => {
  it('scopes the list query to the authenticated tenant, not a hardcoded default', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await fetch(`${baseUrl}/`);
    expect(mockedQuery.mock.calls[0][1][0]).toBe('acme-corp');
  });
});

describe('GET /api/v1/alerts/stats', () => {
  it('scopes the stats query to the authenticated tenant', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    await fetch(`${baseUrl}/stats`);
    expect(mockedQuery.mock.calls[0][1]).toEqual(['acme-corp']);
  });
});

describe('POST /api/v1/alerts', () => {
  it('creates the alert under the authenticated tenant', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'a1', tenant_id: 'acme-corp' }] });

    await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Suspicious login', severity: 'high' }),
    });

    const params = mockedQuery.mock.calls[0][1];
    expect(params[params.length - 1]).toBe('acme-corp');
  });
});
