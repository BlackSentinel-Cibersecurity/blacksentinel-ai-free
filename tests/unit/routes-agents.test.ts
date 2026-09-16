// BLACKSENTINEL AI - Agent routes: real tests against the real route code.
//
// Unlike tests/unit/ai-engine.test.ts (pre-existing), this file imports the
// actual `createAgentRoutes()` handler and exercises it over a real HTTP
// server on an ephemeral port, with only the Postgres pool mocked. It fails
// if the route logic breaks, which is the point of a test.

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

describe('GET /api/v1/agents/status', () => {
  it('marks soc/threat_hunter/incident_response as implemented, the rest as not_implemented', async () => {
    const res = await fetch(`${baseUrl}/status`);
    const body = await res.json();

    const soc = body.agents.find((a: any) => a.type === 'soc');
    const threatHunter = body.agents.find((a: any) => a.type === 'threat_hunter');
    const incidentResponse = body.agents.find((a: any) => a.type === 'incident_response');
    const vulnerability = body.agents.find((a: any) => a.type === 'vulnerability');

    expect(soc.implemented).toBe(true);
    expect(soc.status).toBe('idle');
    expect(threatHunter.implemented).toBe(true);
    expect(threatHunter.status).toBe('idle');
    expect(incidentResponse.implemented).toBe(true);
    expect(incidentResponse.status).toBe('idle');
    expect(vulnerability.implemented).toBe(false);
    expect(vulnerability.status).toBe('not_implemented');
  });
});

describe('POST /api/v1/agents/:agentType/process', () => {
  it('rejects an unknown agent type with 400', async () => {
    const res = await fetch(`${baseUrl}/not-a-real-agent/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'hi', tenantId: 'test-tenant', userId: 'u1' }),
    });
    expect(res.status).toBe(400);
  });

  it('refuses unimplemented agents with 501 instead of a canned answer', async () => {
    const res = await fetch(`${baseUrl}/vulnerability/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'prioritize these CVEs', tenantId: 'test-tenant', userId: 'u1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(501);
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('reports a clean environment when there are no open alerts', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // free-plan monthly quota check
    mockedQuery.mockResolvedValueOnce({
      rows: [{ open_count: 0, critical_count: 0, high_count: 0 }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // top alerts (unused when open_count is 0)

    const res = await fetch(`${baseUrl}/soc/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'what is happening', tenantId: 'test-tenant', userId: 'u1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.agent).toBe('soc');
    expect(body.answer).toMatch(/no open alerts/i);
    expect(body.confidence).toBeLessThan(0.7);
  });

  it('summarizes real open alerts, ranks critical first, and proposes investigate actions', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // free-plan monthly quota check
    mockedQuery.mockResolvedValueOnce({
      rows: [{ open_count: 3, critical_count: 1, high_count: 1 }],
    });
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a1', title: 'Ransomware beacon detected', severity: 'critical', status: 'new', source: 'EDR', confidence: 0.9, created_at: new Date() },
        { id: 'a2', title: 'Suspicious login', severity: 'high', status: 'investigating', source: 'SIEM', confidence: 0.6, created_at: new Date() },
        { id: 'a3', title: 'Port scan', severity: 'low', status: 'new', source: 'IDS', confidence: 0.4, created_at: new Date() },
      ],
    });
    // conversation persistence
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    const res = await fetch(`${baseUrl}/soc/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'what is the current alert picture', tenantId: 'test-tenant', userId: 'u1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.answer).toContain('3 open alerts');
    expect(body.answer).toMatch(/CRITICAL|critical/);
    expect(body.reasoning.evidence.length).toBe(3);
    expect(body.actions.some((a: any) => a.alertId === 'a1')).toBe(true);
    // low-severity alert should not generate an "investigate" action
    expect(body.actions.some((a: any) => a.alertId === 'a3')).toBe(false);

    // the exchange should have been persisted (conversation + messages insert)
    expect(mockedQuery.mock.calls.length).toBe(5);
    expect(mockedQuery.mock.calls[3][0]).toMatch(/INSERT INTO conversations/);
    expect(mockedQuery.mock.calls[4][0]).toMatch(/INSERT INTO conversation_messages/);
  });

  it('scopes the alert query to the authenticated tenant, not a client-supplied one', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // free-plan monthly quota check
    mockedQuery.mockResolvedValueOnce({ rows: [{ open_count: 0, critical_count: 0, high_count: 0 }] });
    mockedQuery.mockResolvedValueOnce({ rows: [] });

    await fetch(`${baseUrl}/soc/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // attempt to read another tenant's data by spoofing tenantId in the body
      body: JSON.stringify({ query: 'status?', tenantId: 'someone-elses-tenant', userId: 'u1' }),
    });

    const [, params] = mockedQuery.mock.calls[0];
    expect(params).toEqual(['test-tenant']); // from the (mocked) authenticated request, not the body
  });
});
