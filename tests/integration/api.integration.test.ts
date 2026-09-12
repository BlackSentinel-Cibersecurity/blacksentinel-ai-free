// BLACKSENTINEL AI - Real integration tests
//
// Everything in tests/unit mocks `pool` — real, but never once validated
// that the actual SQL is correct against an actual Postgres schema, or that
// auth/tenant-isolation/agent logic works wired together for real. This suite
// runs the real Express routes, real `pg` pool, real Redis, real bcrypt/JWT,
// against a real Postgres with the real schema applied — no mocks anywhere.
//
// Needs POSTGRES_URL and REDIS_URL pointing at real, disposable instances -
// this creates and deletes real rows. Locally:
//   docker run -d -p 5433:5432 -e POSTGRES_DB=blacksentinel_test \
//     -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test postgres:16-alpine
//   docker run -d -p 6380:6379 redis:7-alpine
//   POSTGRES_URL=postgresql://test:test@localhost:5433/blacksentinel_test \
//     npx tsx src/database/migrate.ts
//   POSTGRES_URL=postgresql://test:test@localhost:5433/blacksentinel_test \
//   REDIS_URL=redis://localhost:6380 npm run test:integration
// `npm run test:integration` sets RUN_INTEGRATION_TESTS=1 itself (see
// package.json) — that's the actual gate (see below), not just whether
// POSTGRES_URL happens to be set, since a real .env already sets that for
// normal app operation and `npm test` must never silently run destructive
// integration tests against whatever database that points at. CI sets all
// three (see .github/workflows/ci-cd.yml) against the postgres/redis
// services it provisions.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-jwt-secret-32-characters-min';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'integration-test-encryption-key-32-chars-min';

// Gated on an explicit opt-in, not just "is POSTGRES_URL set" — that's
// already set in a real .env for normal app operation, so gating on its
// mere presence would make `npm test` silently try to run destructive
// integration tests (real INSERT/UPDATE/DELETE) against whatever database
// happens to be configured there, including a real one. test:integration
// sets this explicitly (see package.json); CI does too.
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === '1';

import { pool } from '../../src/server/db';
import { createAuthRoutes } from '../../src/server/routes/auth';
import { createAlertRoutes } from '../../src/server/routes/alerts';
import { createAgentRoutes } from '../../src/server/routes/agents';
import { authenticate } from '../../src/server/middleware/auth';

let server: Server;
let baseUrl: string;
const tenantAEmail = `tenant-a-${Date.now()}@example.com`;
const tenantBEmail = `tenant-b-${Date.now()}@example.com`;
let tenantAToken: string;
let tenantBToken: string;

// Skips the whole suite with a clear reason instead of failing opaquely when
// no real database is configured (e.g. a plain `npx vitest run` locally
// without the containers up) - test:integration is meant to be run with
// POSTGRES_URL set, same as CI does.
const maybeDescribe = RUN_INTEGRATION ? describe : describe.skip;

maybeDescribe('Real integration: auth + alerts + SOC agent against a real Postgres', () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/auth', createAuthRoutes());
    app.use('/api/v1/alerts', authenticate, createAlertRoutes());
    app.use('/api/v1/agents', authenticate, createAgentRoutes());

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // Clean up everything this run created so re-running the suite locally
    // (against a persistent local Postgres, unlike CI's ephemeral service
    // container) doesn't accumulate rows and make later assertions flaky.
    await pool.query(`DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id IN ('tenant-a', 'tenant-b'))`);
    await pool.query(`DELETE FROM conversations WHERE tenant_id IN ('tenant-a', 'tenant-b')`);
    await pool.query(`DELETE FROM alerts WHERE tenant_id IN ('tenant-a', 'tenant-b')`);
    await pool.query(`DELETE FROM users WHERE email IN ($1, $2)`, [tenantAEmail, tenantBEmail]);
    await pool.end();
  });

  it('has every table from database/schema.sql actually present', async () => {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tables = result.rows.map((r) => r.table_name).sort();
    for (const expected of [
      'users', 'audit_log', 'alerts', 'incidents', 'investigations', 'playbooks',
      'iocs', 'memory_entries', 'models', 'conversations', 'conversation_messages',
      'kg_nodes', 'kg_edges',
    ]) {
      expect(tables).toContain(expected);
    }
  });

  it('registers a real user, hashes a real password, and rejects a wrong one on login', async () => {
    const register = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: tenantAEmail,
        password: 'CorrectHorseBattery1',
        name: 'Tenant A Analyst',
        role: 'soc_analyst',
        tenantId: 'tenant-a',
      }),
    });
    expect(register.status).toBe(201);

    const wrongPassword = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: tenantAEmail, password: 'totally-wrong-password' }),
    });
    expect(wrongPassword.status).toBe(401);

    // register() puts every new user in tenant_id='default' (see routes/auth.ts) -
    // patch this one directly to a distinct tenant so the isolation test below
    // means something.
    await pool.query(`UPDATE users SET tenant_id = 'tenant-a' WHERE email = $1`, [tenantAEmail]);

    const correctPassword = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: tenantAEmail, password: 'CorrectHorseBattery1' }),
    });
    expect(correctPassword.status).toBe(200);
    const body = await correctPassword.json();
    expect(body.token).toBeTruthy();
    tenantAToken = body.token;
  });

  it('registers a second tenant and confirms its token is distinct', async () => {
    await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: tenantBEmail,
        password: 'AnotherStrongPass1',
        name: 'Tenant B Analyst',
        role: 'soc_analyst',
        tenantId: 'tenant-b',
      }),
    });
    await pool.query(`UPDATE users SET tenant_id = 'tenant-b' WHERE email = $1`, [tenantBEmail]);

    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: tenantBEmail, password: 'AnotherStrongPass1' }),
    });
    const body = await login.json();
    tenantBToken = body.token;
    expect(tenantBToken).not.toBe(tenantAToken);
  });

  it('creates a real alert for tenant A and tenant B cannot see it', async () => {
    const created = await fetch(`${baseUrl}/api/v1/alerts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${tenantAToken}` },
      body: JSON.stringify({ title: 'Integration test alert', severity: 'critical', source: 'integration-test' }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.alert.tenant_id).toBe('tenant-a');

    const asTenantA = await fetch(`${baseUrl}/api/v1/alerts`, {
      headers: { Authorization: `Bearer ${tenantAToken}` },
    });
    const tenantAAlerts = await asTenantA.json();
    expect(tenantAAlerts.alerts.some((a: any) => a.id === createdBody.alert.id)).toBe(true);

    const asTenantB = await fetch(`${baseUrl}/api/v1/alerts`, {
      headers: { Authorization: `Bearer ${tenantBToken}` },
    });
    const tenantBAlerts = await asTenantB.json();
    expect(tenantBAlerts.alerts.some((a: any) => a.id === createdBody.alert.id)).toBe(false);
  });

  it('the real SOC agent reasons over the real alert just created', async () => {
    const res = await fetch(`${baseUrl}/api/v1/agents/soc/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${tenantAToken}` },
      body: JSON.stringify({ query: 'what is the current alert picture' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.answer).toMatch(/open alert/);
    expect(body.answer).toMatch(/CRITICAL/);
    expect(body.reasoning.evidence.some((e: string) => e.includes('Integration test alert'))).toBe(true);
    expect(body.actions.length).toBeGreaterThan(0);

    // and it really persisted the exchange to conversation_messages
    const messages = await pool.query(
      `SELECT content FROM conversation_messages WHERE conversation_id = $1 AND role = 'assistant'`,
      [body.conversationId]
    );
    expect(messages.rows.length).toBe(1);
    expect(messages.rows[0].content).toBe(body.answer);
  });

  it('rejects requests with no token and with a garbage token', async () => {
    const noToken = await fetch(`${baseUrl}/api/v1/alerts`);
    expect(noToken.status).toBe(401);

    const badToken = await fetch(`${baseUrl}/api/v1/alerts`, {
      headers: { Authorization: 'Bearer not-a-real-jwt' },
    });
    expect(badToken.status).toBe(401);
  });
});
