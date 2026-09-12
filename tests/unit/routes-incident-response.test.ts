// BLACKSENTINEL AI - Incident Response agent: real incident triage +
// playbook matching, exercised through /api/v1/agents/:type/process.

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

async function callIR(query: string) {
  return fetch(`${baseUrl}/incident_response/process`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, tenantId: 'test-tenant', userId: 'u1' }),
  });
}

describe('POST /api/v1/agents/incident_response/process', () => {
  it('matches an open critical incident to a playbook by trigger_condition', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'inc1', title: 'Ransomware on file server', severity: 'critical', status: 'open', created_at: new Date(Date.now() - 3 * 3_600_000) }],
    });
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'pb1', playbook_id: 'PB-001', name: 'Ransomware Containment', trigger_condition: 'severity == critical', success_rate: 0.8 }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // conversation insert
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // message insert

    const res = await callIR('what incidents are open');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.answer).toContain('1 open incident');
    expect(body.answer).toMatch(/1 critical/);
    expect(body.reasoning.evidence[0]).toContain('Ransomware Containment');
    expect(body.actions[0].label).toContain('Run playbook "Ransomware Containment"');
  });

  it('flags an incident with no matching playbook honestly', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'inc1', title: 'Unusual cloud API calls', severity: 'high', status: 'investigating', created_at: new Date() }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // no playbooks on file
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await callIR('status?');
    const body = await res.json();

    expect(body.actions[0].label).toContain('no playbook');
  });

  it('reports no open incidents honestly', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await callIR('anything open?');
    const body = await res.json();

    expect(body.answer).toMatch(/No open incidents/);
  });
});
