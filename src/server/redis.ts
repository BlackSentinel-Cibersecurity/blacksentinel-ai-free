// BLACKSENTINEL AI - Redis Connection
//
// Redis was already provisioned in docker-compose and listed as a dependency,
// but nothing in src/server actually connected to it — the rate limiter used
// a plain in-memory Map instead, which resets on every restart and doesn't
// work correctly once there's more than one server instance (each instance
// enforces its own separate limit, so real throughput is N times the
// configured max). This client makes Redis actually do something.

import Redis from 'ioredis';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';

const log = createChildLogger('redis');

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
  retryStrategy(times) {
    return Math.min(times * 200, 5000);
  },
});

redis.on('error', (err) => {
  log.error({ err }, 'Redis connection error');
});

redis.on('connect', () => {
  log.info('Redis connected');
});

export default redis;
