// BLACKSENTINEL AI - Generative routes: verifies the real generator engine
// produces real artifact content, not a placeholder string.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createGenerativeRoutes } from '../../src/server/routes/generative';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/generative',
    (req, _res, next) => {
      (req as any).tenantId = 'test-tenant';
      (req as any).userId = 'test-user';
      next();
    },
    createGenerativeRoutes()
  );

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/generative`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('POST /api/v1/generative/generate', () => {
  it('generates a real Sigma rule containing the requested MITRE technique', async () => {
    const res = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'sigma',
        title: 'Suspicious PsExec Usage',
        description: 'Lateral movement via PsExec',
        mitreMapping: ['T1021.002'],
        tenantId: 'test-tenant',
        userId: 'test-user',
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.content).toContain('title: Suspicious PsExec Usage');
    expect(body.content).toContain('T1021.002');
    expect(body.content).toContain('detection:');
    // not the old placeholder
    expect(body.content).not.toMatch(/^Generated sigma artifact/);
  });

  it('generates a real YARA rule with a sanitized rule name', async () => {
    const res = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'yara',
        title: 'Cobalt Strike Beacon!',
        tenantId: 'test-tenant',
        userId: 'test-user',
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.content).toContain('rule Cobalt_Strike_Beacon_');
    expect(body.content).toContain('strings:');
    expect(body.content).toContain('condition:');
  });

  it('rejects an unknown artifact type before generating anything', async () => {
    const res = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'not-a-real-type', tenantId: 'test-tenant', userId: 'test-user' }),
    });
    expect(res.status).toBe(500); // zod validation throws -> error middleware (none mounted -> express default)
  });
});

describe('GET /api/v1/generative/templates', () => {
  it('lists the 11 supported artifact types', async () => {
    const res = await fetch(`${baseUrl}/templates`);
    const body = await res.json();
    expect(body.templates.length).toBe(11);
  });
});
