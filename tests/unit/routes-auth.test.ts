// BLACKSENTINEL AI - Auth routes: real password verification, brute-force
// lockout, and audit logging.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';

vi.mock('../../src/server/db', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../../src/server/redis', () => ({
  redis: {},
}));

// A minimal in-memory stand-in for RateLimiterRedis/RateLimiterMemory so
// these tests don't need a real Redis connection, while still exercising the
// real lockout logic in routes/auth.ts (get/consume/delete against a
// points counter that behaves the same way).
vi.mock('rate-limiter-flexible', () => {
  class FakeLimiter {
    private counts = new Map<string, number>();
    constructor(private opts: { points: number; blockDuration: number }) {}
    async get(key: string) {
      const count = this.counts.get(key) || 0;
      if (count === 0) return null;
      return { remainingPoints: Math.max(this.opts.points - count, 0), msBeforeNext: this.opts.blockDuration * 1000 };
    }
    async consume(key: string) {
      const count = (this.counts.get(key) || 0) + 1;
      this.counts.set(key, count);
      const remainingPoints = this.opts.points - count;
      if (remainingPoints < 0) {
        return Promise.reject({ remainingPoints: 0, msBeforeNext: this.opts.blockDuration * 1000 });
      }
      return { remainingPoints, msBeforeNext: 0 };
    }
    async delete(key: string) {
      this.counts.delete(key);
    }
  }
  return { RateLimiterRedis: FakeLimiter, RateLimiterMemory: FakeLimiter };
});

import { pool } from '../../src/server/db';
import { createAuthRoutes } from '../../src/server/routes/auth';

const mockedQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-at-least-32-characters-long';
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-at-least-32-characters';

  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', createAuthRoutes());

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v1/auth`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  mockedQuery.mockReset();
});

async function login(email: string, password: string) {
  return fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

describe('POST /api/v1/auth/login', () => {
  it('rejects a wrong password even when the email exists (the bug that shipped before)', async () => {
    // bcrypt hash of "CorrectHorseBattery1" - the request below sends a
    // different password, so comparePassword must return false.
    mockedQuery.mockResolvedValueOnce({
      rows: [{ id: 'u1', email: 'admin@blacksentinel.ai', name: 'Admin', password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX', role: 'admin', tenant_id: 'default' }],
    });
    mockedQuery.mockResolvedValueOnce({ rows: [] }); // audit log insert

    const res = await login('admin@blacksentinel.ai', 'literally-any-8-plus-char-string');
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks out after 5 failed attempts for the same email', async () => {
    const email = 'lockout-target@example.com';
    mockedQuery.mockResolvedValue({
      rows: [{ id: 'u2', email, name: 'X', password_hash: '$2a$10$invalidhashinvalidhashinvalidhashinvalidhas', role: 'viewer', tenant_id: 'default' }],
    });

    for (let i = 0; i < 5; i++) {
      const res = await login(email, 'wrong-password-attempt');
      expect(res.status).toBe(401);
    }

    const sixth = await login(email, 'wrong-password-attempt');
    const body = await sixth.json();

    expect(sixth.status).toBe(429);
    expect(body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(sixth.headers.get('retry-after')).toBeTruthy();
  });

  it('does not consume the lockout counter for an unrelated email', async () => {
    mockedQuery.mockResolvedValue({ rows: [] }); // no such user, every time

    for (let i = 0; i < 5; i++) {
      await login('never-registered@example.com', 'whatever');
    }

    // a fresh email should not be affected by the other one's attempts
    const res = await login('someone-else@example.com', 'whatever');
    expect(res.status).toBe(401); // still just "invalid credentials", not locked out
  });
});
