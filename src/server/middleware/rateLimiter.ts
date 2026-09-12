// BLACKSENTINEL AI - Rate Limiter Middleware
//
// Previously backed by a plain in-memory Map: counters reset on every
// restart, and with more than one server instance each instance enforces its
// own independent limit (so the *effective* limit is N times the configured
// max with N instances behind a load balancer). Now backed by Redis via
// rate-limiter-flexible, with an in-memory fallback (RateLimiterMemory) if
// Redis is unreachable, so a Redis outage degrades rate limiting instead of
// taking the API down.

import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { RateLimitError } from '@blacksentinel/shared/utils/errors';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { redis } from '../redis';

const log = createChildLogger('middleware:rateLimiter');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

export function createRateLimiter(windowMs: number = WINDOW_MS, maxRequests: number = MAX_REQUESTS) {
  const windowSeconds = Math.max(Math.round(windowMs / 1000), 1);

  const insuranceLimiter = new RateLimiterMemory({
    points: maxRequests,
    duration: windowSeconds,
  });

  const limiter = new RateLimiterRedis({
    storeClient: redis,
    points: maxRequests,
    duration: windowSeconds,
    keyPrefix: 'rl',
    insuranceLimiter, // used automatically if Redis calls fail/time out
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = (req as any).userId || req.ip || 'unknown';

    try {
      const result = await limiter.consume(key);
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints.toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());
      next();
    } catch (rejection: any) {
      if (rejection instanceof Error) {
        // Unexpected error (not a rate-limit rejection) - fail open rather
        // than block all traffic because of an infra hiccup, but log it.
        log.error({ error: rejection }, 'Rate limiter error, allowing request through');
        return next();
      }

      const retryAfter = Math.ceil((rejection.msBeforeNext || windowMs) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + (rejection.msBeforeNext || windowMs)).toISOString());
      next(new RateLimitError(retryAfter));
    }
  };
}
