// BLACKSENTINEL AI - Auth Routes (Database-backed)
//
// Two things added on top of the real password/refresh-token verification:
//   - Brute-force lockout: 5 failed attempts per email locks that email out
//     for 15 minutes, backed by Redis (rate-limiter-flexible) so it holds
//     across restarts and multiple instances, unlike the old in-memory
//     general rate limiter which only throttled by IP/user, not by target
//     account.
//   - Every auth event (login success/failure/lockout, register, refresh
//     success/failure) is written to `audit_log` — previously nothing in
//     the live server wrote to that table at all despite it existing since
//     the first commit and the README claiming "immutable audit logging".

import { Router, Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { validateOrThrow, LoginRequestSchema, CreateUserSchema } from '@blacksentinel/shared/utils/validation';
import { cryptoUtils } from '@blacksentinel/shared/utils/crypto';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { pool } from '../db';
import { redis } from '../redis';
import { writeAudit } from '../services/auditLog';

const log = createChildLogger('routes:auth');
const router = Router();

const ROLE_COLORS: Record<string, string> = {
  soc_analyst: BRAND.colors.orange.primary,
  admin: BRAND.colors.critical,
  viewer: BRAND.colors.gray.light,
  threat_hunter: BRAND.colors.warning,
  incident_responder: BRAND.colors.info,
};

const LOGIN_LOCKOUT_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60;

const loginAttemptLimiter = new RateLimiterRedis({
  storeClient: redis,
  points: LOGIN_LOCKOUT_MAX_ATTEMPTS,
  duration: LOGIN_LOCKOUT_WINDOW_SECONDS,
  blockDuration: LOGIN_LOCKOUT_WINDOW_SECONDS,
  keyPrefix: 'login_fail',
});

function withBrand<T extends Record<string, unknown>>(body: T) {
  return { brand: { logo: BRAND.logo.primary, colors: BRAND.colors }, ...body };
}

function lockoutKey(email: string): string {
  return email.trim().toLowerCase();
}

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(LoginRequestSchema, req.body);
    const key = lockoutKey(validated.email);

    const existingLimit = await loginAttemptLimiter.get(key);
    if (existingLimit !== null && existingLimit.remainingPoints <= 0) {
      const retryAfter = Math.ceil(existingLimit.msBeforeNext / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      await writeAudit({
        action: 'login_blocked',
        actor: validated.email,
        resource: 'auth',
        details: { reason: 'too many failed attempts' },
        tenantId: 'unknown',
        req,
      });
      return res.status(429).json(
        withBrand({
          error: {
            code: 'TOO_MANY_ATTEMPTS',
            message: `Too many failed login attempts. Try again in ${retryAfter}s.`,
          },
        })
      );
    }

    const result = await pool.query(
      'SELECT id, email, name, password_hash, role, tenant_id FROM users WHERE email = $1 AND is_active = true',
      [validated.email]
    );

    if (result.rows.length === 0) {
      await loginAttemptLimiter.consume(key).catch(() => {});
      await writeAudit({ action: 'login_failed', actor: validated.email, resource: 'auth', details: { reason: 'no such user' }, tenantId: 'unknown', req });
      return res.status(401).json(withBrand({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }));
    }

    const user = result.rows[0];

    const passwordValid = await cryptoUtils.comparePassword(validated.password, user.password_hash);
    if (!passwordValid) {
      log.warn({ email: validated.email }, 'Login failed: wrong password');
      await loginAttemptLimiter.consume(key).catch(() => {});
      await writeAudit({ action: 'login_failed', actor: user.id, resource: 'auth', tenantId: user.tenant_id, details: { reason: 'wrong password' }, req });
      return res.status(401).json(withBrand({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }));
    }

    await loginAttemptLimiter.delete(key).catch(() => {});

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = cryptoUtils.generateToken({
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role,
    });

    const refreshToken = cryptoUtils.generateToken(
      { userId: user.id, type: 'refresh' },
      '7d'
    );

    log.info({ email: validated.email, userId: user.id }, 'User logged in');
    await writeAudit({ action: 'login_succeeded', actor: user.id, resource: 'auth', tenantId: user.tenant_id, req });

    res.json(
      withBrand({
        token,
        refreshToken,
        expiresIn: 86400,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          roleColor: ROLE_COLORS[user.role] || BRAND.colors.gray.medium,
        },
      })
    );
  } catch (error) {
    log.error({ error }, 'Login failed');
    next(error);
  }
});

// POST /api/v1/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(CreateUserSchema, req.body);

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [validated.email]);
    if (existing.rows.length > 0) {
      return res.status(409).json(
        withBrand({ error: { code: 'USER_EXISTS', message: 'An account with this email already exists' } })
      );
    }

    const passwordHash = await cryptoUtils.hashPassword(validated.password);
    const tenantId = 'default';

    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, company, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, name, role, tenant_id, created_at`,
      [validated.email, validated.name, passwordHash, validated.role || 'viewer', validated.company || null, tenantId]
    );

    const user = result.rows[0];

    log.info({ userId: user.id }, 'User registered');
    await writeAudit({ action: 'user_registered', actor: user.id, resource: 'auth', resourceId: user.id, tenantId, req });

    res.status(201).json(
      withBrand({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roleColor: ROLE_COLORS[user.role] || BRAND.colors.gray.medium,
        createdAt: user.created_at,
      })
    );
  } catch (error) {
    log.error({ error }, 'Registration failed');
    next(error);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json(withBrand({ error: { code: 'MISSING_TOKEN', message: 'Refresh token required' } }));
  }

  try {
    const payload = cryptoUtils.verifyToken(refreshToken);
    if (payload.type !== 'refresh' || typeof payload.userId !== 'string') {
      return res.status(401).json(withBrand({ error: { code: 'INVALID_TOKEN', message: 'Not a valid refresh token' } }));
    }

    const result = await pool.query(
      'SELECT id, email, tenant_id, role FROM users WHERE id = $1 AND is_active = true',
      [payload.userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json(withBrand({ error: { code: 'INVALID_TOKEN', message: 'User no longer active' } }));
    }
    const user = result.rows[0];

    const token = cryptoUtils.generateToken({
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role,
    });

    await writeAudit({ action: 'token_refreshed', actor: user.id, resource: 'auth', tenantId: user.tenant_id, req });

    res.json(withBrand({ token, expiresIn: 86400 }));
  } catch (error) {
    log.warn({ error }, 'Refresh token verification failed');
    await writeAudit({ action: 'token_refresh_failed', actor: 'unknown', resource: 'auth', tenantId: 'unknown', req });
    return res.status(401).json(withBrand({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } }));
  }
});

export function createAuthRoutes(): Router {
  return router;
}
