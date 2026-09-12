// BLACKSENTINEL AI - Metrics Routes

import { Router, Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { getStatusColor } from '../middleware/brand';

const log = createChildLogger('routes:metrics');
const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const heapUsed = process.memoryUsage().heapUsed;
  const heapTotal = process.memoryUsage().heapTotal;
  const memoryUsagePercent = heapUsed / heapTotal;

  const metrics = {
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
    },
    requests: { total: 0, errors: 0, byEndpoint: {} },
    latency: { avg: 0, p50: 0, p95: 0, p99: 0 },
    memory: {
      used: heapUsed,
      total: heapTotal,
      usagePercent: memoryUsagePercent,
      color: memoryUsagePercent > 0.8 ? BRAND.colors.critical : memoryUsagePercent > 0.6 ? BRAND.colors.warning : BRAND.colors.success,
    },
    cpu: { usage: process.cpuUsage() },
    timestamp: new Date().toISOString(),
  };

  res.json(metrics);
});

export function createMetricsRoutes(): Router {
  return router;
}
