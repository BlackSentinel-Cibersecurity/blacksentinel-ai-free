// BLACKSENTINEL AI - Threat Hunter agent: real IOC correlation + campaign
// detection, exercised through the same /api/v1/agents/:type/process route
// used for the SOC agent.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

vi.mock('../../src/server/db', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '../../src/server/db';
import { createAgentRoutes } from '../../src/server/routes/agents';

const mockedQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/agents',
    (req, _res, next) => {
      (req as any).tenantId = 'test-tenant';
      (req as any).userId = 'test-user';
      next();
    },
    createAgentRoutes()
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/agents`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  mockedQuery.mockReset();
});

async function callThreatHunter(query: string) {
  return fetch(`${baseUrl}/threat_hunter/process`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, tenantId: 'test-tenant', userId: 'u1' }),
  });
}

describe('POST /api/v1/agents/threat_hunter/process', () => {
  it('is now implemented (status endpoint agrees)', async () => {
    const res = await fetch(`${baseUrl}/status`);
    const body = await res.json();
    const hunter = body.agents.find((a: any) => a.type === 'threat_hunter');
    expect(hunter.implemented).toBe(true);
    expect(hunter.status).toBe('idle');
  });

  it('flags an IOC match between an alert and a known indicator', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', title: 'Beacon to 45.33.12.9 detected', description: null, severity: 'high', source: 'EDR', created_at: new Date() },
        { id: 'a2', title: 'Routine login', description: null, severity: 'low', source: 'IdP', created_at: new Date() },
      ],
    });
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'i1', type: 'ip', value: '45.33.12.9', threat_type: 'c2', confidence: 0.95 }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // conversation insert
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // message insert

    const res = await callThreatHunter('hunt for known indicators');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.answer).toMatch(/1 alert matches a known high-confidence IOC/);
    expect(body.reasoning.evidence[0]).toContain('45.33.12.9');
    expect(body.actions[0].alertId).toBe('a1');
  });

  it('flags a burst of alerts from one source as a possible campaign', async () => {
    const burst = Array.from({ length: 4 }, (_, i) => ({
      id: `a${i}`, title: `Alert ${i}`, description: null, severity: 'medium', source: 'firewall-01', created_at: new Date(),
    }));
    mockedQuery.mockResolvedValueOnce({ rows: burst });
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // no IOCs
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await callThreatHunter('anything unusual?');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.answer).toMatch(/Possible campaign: 4 alerts from source "firewall-01"/);
  });

  it('reports a clean hunt when nothing correlates', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'a1', title: 'Benign alert', description: null, severity: 'low', source: 'SIEM', created_at: new Date() }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await callThreatHunter('anything?');
    const body = await res.json();

    expect(body.answer).toMatch(/no IOC matches or unusual bursts found/);
  });
});
