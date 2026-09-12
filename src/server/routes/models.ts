// BLACKSENTINEL AI - Model Registry Routes (Database-backed)
//
// Previously returned two hardcoded fake models ('Sentinel LLM', 'Threat
// Classifier') on every GET regardless of what had been registered, and
// register/deploy/rollback/metrics never persisted anything even though the
// `models` table already existed in database/schema.sql. Deploy/rollback
// update real status; metrics are read from what was actually recorded, not
// fabricated numbers - a freshly registered model correctly shows zeros
// rather than a fake 0.9 accuracy.

import { Router, Request, Response, NextFunction } from 'express';
import { validateOrThrow, RegisterModelSchema } from '@blacksentinel/shared/utils/validation';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { getStatusColor, getConfidenceColor } from '../middleware/brand';
import { pool } from '../db';

const log = createChildLogger('routes:models');
const router = Router();

interface ModelRow {
  id: string;
  name: string;
  version: string;
  type: string;
  provider: string;
  endpoint: string | null;
  capabilities: string[] | null;
  status: string;
  metrics: { accuracy?: number; latency?: number; totalRequests?: number; errorRate?: number } | null;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

function withBrand<T extends Record<string, unknown>>(body: T) {
  return { brand: { logo: BRAND.logo.primary, colors: BRAND.colors }, ...body };
}

function tenantOf(req: Request): string {
  return (req as any).tenantId || 'default';
}

function decorate(model: ModelRow) {
  const accuracy = model.metrics?.accuracy ?? 0;
  return {
    ...model,
    statusColor: getStatusColor(model.status),
    accuracyColor: getConfidenceColor(accuracy),
  };
}

// GET /api/v1/models
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<ModelRow>(
      'SELECT * FROM models WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantOf(req)]
    );
    res.json(withBrand({ models: result.rows.map(decorate) }));
  } catch (error) {
    log.error({ error }, 'Failed to list models');
    next(error);
  }
});

// POST /api/v1/models
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(RegisterModelSchema, req.body);
    const tenantId = tenantOf(req);

    const result = await pool.query<ModelRow>(
      `INSERT INTO models (name, version, type, provider, endpoint, capabilities, status, metrics, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'inactive', $7, $8)
       RETURNING *`,
      [
        validated.name,
        validated.version,
        validated.type,
        validated.provider,
        validated.endpoint,
        JSON.stringify(validated.capabilities),
        JSON.stringify({ accuracy: 0, latency: 0, totalRequests: 0 }),
        tenantId,
      ]
    );

    log.info({ modelId: result.rows[0].id, name: result.rows[0].name }, 'Model registered');
    res.status(201).json(withBrand({ ...decorate(result.rows[0]) }));
  } catch (error) {
    log.error({ error }, 'Model registration failed');
    next(error);
  }
});

// GET /api/v1/models/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<ModelRow>('SELECT * FROM models WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      tenantOf(req),
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json(withBrand({ error: { code: 'NOT_FOUND', message: 'Model not found' } }));
    }
    res.json(withBrand(decorate(result.rows[0])));
  } catch (error) {
    log.error({ error }, 'Failed to fetch model');
    next(error);
  }
});

// POST /api/v1/models/:id/deploy
router.post('/:id/deploy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<ModelRow>(
      `UPDATE models SET status = 'active', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [req.params.id, tenantOf(req)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(withBrand({ error: { code: 'NOT_FOUND', message: 'Model not found' } }));
    }
    log.info({ modelId: req.params.id }, 'Model deployed');
    res.json(withBrand(decorate(result.rows[0])));
  } catch (error) {
    log.error({ error }, 'Model deployment failed');
    next(error);
  }
});

// POST /api/v1/models/:id/rollback
router.post('/:id/rollback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<ModelRow>(
      `UPDATE models SET status = 'inactive', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [req.params.id, tenantOf(req)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(withBrand({ error: { code: 'NOT_FOUND', message: 'Model not found' } }));
    }
    log.info({ modelId: req.params.id }, 'Model rolled back');
    res.json(withBrand(decorate(result.rows[0])));
  } catch (error) {
    log.error({ error }, 'Model rollback failed');
    next(error);
  }
});

// GET /api/v1/models/:id/metrics
router.get('/:id/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<ModelRow>('SELECT * FROM models WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      tenantOf(req),
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json(withBrand({ error: { code: 'NOT_FOUND', message: 'Model not found' } }));
    }
    const model = result.rows[0];
    const accuracy = model.metrics?.accuracy ?? 0;
    res.json(
      withBrand({
        modelId: model.id,
        metrics: model.metrics ?? { accuracy: 0, latency: 0, totalRequests: 0, errorRate: 0 },
        accuracyColor: getConfidenceColor(accuracy),
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    log.error({ error }, 'Failed to fetch model metrics');
    next(error);
  }
});

export function createModelRoutes(): Router {
  return router;
}
