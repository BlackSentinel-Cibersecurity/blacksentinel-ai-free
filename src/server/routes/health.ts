// BLACKSENTINEL AI - Health Routes

import { Router, Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { getStatusColor } from '../middleware/brand';

const log = createChildLogger('routes:health');
const router = Router();

const startTime = Date.now();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const components = {
    aiEngine: 'operational',
    knowledgeGraph: 'operational',
    memoryService: 'operational',
    agentOrchestrator: 'operational',
    predictiveEngine: 'operational',
    xaiModule: 'operational',
    observability: 'operational',
  };

  const health = {
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
      fonts: BRAND.fonts,
    },
    status: 'healthy',
    uptime: (Date.now() - startTime) / 1000,
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    components: Object.entries(components).map(([name, status]) => ({
      name,
      status,
      color: getStatusColor(status),
    })),
    timestamp: new Date().toISOString(),
  };

  res.json(health);
});

router.get('/ready', async (req: Request, res: Response, next: NextFunction) => {
  res.json({
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
    },
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

export function createHealthRoutes(): Router {
  return router;
}
