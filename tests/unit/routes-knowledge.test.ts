// BLACKSENTINEL AI - Knowledge graph routes: real tests against real route code.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

vi.mock('../../src/server/db', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '../../src/server/db';
import { createKnowledgeRoutes } from '../../src/server/routes/knowledge';

const mockedQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/knowledge',
    (req, _res, next) => {
      (req as any).tenantId = 'test-tenant';
      next();
    },
    createKnowledgeRoutes()
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/knowledge`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  mockedQuery.mockReset();
});

describe('POST /api/v1/knowledge/search', () => {
  it('searches kg_nodes and pulls edges touching the matched nodes', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'n1', type: 'malware', name: 'Emotet', properties: {}, tenant_id: 'test-tenant', created_at: new Date(), updated_at: new Date() }] });
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: 'e1', source_id: 'n1', target_id: 'n2', type: 'targets', properties: {}, weight: 1, created_at: new Date() }] });

    const res = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Emotet' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nodes.length).toBe(1);
    expect(body.nodes[0].color).toBeDefined();
    expect(body.edges.length).toBe(1);
  });

  it('returns no edges when the search finds no nodes (skips the edge query)', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await fetch(`${baseUrl}/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'nothing-like-this-exists' }),
    });
    const body = await res.json();

    expect(body.totalResults).toBe(0);
    expect(body.edges).toEqual([]);
    expect(mockedQuery).toHaveBeenCalledTimes(1); // no wasted second query
  });
});

describe('POST /api/v1/knowledge/graph/nodes', () => {
  it('creates a node scoped to the authenticated tenant', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'n1', type: 'asset', name: 'web-01', properties: { ip: '10.0.0.1' }, tenant_id: 'test-tenant', created_at: new Date(), updated_at: new Date() }],
    });

    const res = await fetch(`${baseUrl}/graph/nodes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'asset', name: 'web-01', properties: { ip: '10.0.0.1' } }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.node.name).toBe('web-01');
    expect(mockedQuery.mock.calls[0][1]).toEqual(['asset', 'web-01', { ip: '10.0.0.1' }, 'test-tenant']);
  });
});

describe('POST /api/v1/knowledge/graph/edges', () => {
  it('returns 400 INVALID_REFERENCE on a foreign key violation instead of a 500', async () => {
    mockedQuery.mockRejectedValueOnce(Object.assign(new Error('violates foreign key constraint'), { code: '23503' }));

    const res = await fetch(`${baseUrl}/graph/edges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: '00000000-0000-0000-0000-000000000001', target: '00000000-0000-0000-0000-000000000002', type: 'connects_to' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('INVALID_REFERENCE');
  });
});

describe('GET /api/v1/knowledge/graph/nodes/:id/neighbors', () => {
  it('walks two hops via BFS and excludes the origin node from the result', async () => {
    const origin = '00000000-0000-0000-0000-000000000001';
    const hop1 = '00000000-0000-0000-0000-000000000002';
    const hop2 = '00000000-0000-0000-0000-000000000003';

    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'e1', source_id: origin, target_id: hop1, type: 'connects_to', properties: {}, weight: 1, created_at: new Date() }],
    });
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'e2', source_id: hop1, target_id: hop2, type: 'connects_to', properties: {}, weight: 1, created_at: new Date() }],
    });
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { id: hop1, type: 'asset', name: 'hop1', properties: {}, tenant_id: 'test-tenant', created_at: new Date(), updated_at: new Date() },
        { id: hop2, type: 'asset', name: 'hop2', properties: {}, tenant_id: 'test-tenant', created_at: new Date(), updated_at: new Date() },
      ],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // edges-by-id lookup, not asserted on here

    const res = await fetch(`${baseUrl}/graph/nodes/${origin}/neighbors?depth=2`);
    const body = await res.json();

    expect(res.status).toBe(200);
    const ids = body.nodes.map((n: any) => n.id);
    expect(ids).toContain(hop1);
    expect(ids).toContain(hop2);
    expect(ids).not.toContain(origin);
  });

  it('clamps depth to the [1, 5] range', async () => {
    mockedQuery.mockResolvedValue({ rows: [] });

    const res = await fetch(`${baseUrl}/graph/nodes/00000000-0000-0000-0000-000000000001/neighbors?depth=99`);
    const body = await res.json();

    expect(body.depth).toBe(5);
  });
});
