// BLACKSENTINEL AI - Playbooks Routes (Database-backed)

import { Router, Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { pool } from '../db';
import { tenantOf } from '../utils/tenant';

const log = createChildLogger('routes:playbooks');
const router = Router();

// GET /api/v1/playbooks - List all playbooks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      'SELECT * FROM playbooks WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantOf(req)]
    );

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      playbooks: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch playbooks');
    next(error);
  }
});

// GET /api/v1/playbooks/:id - Get playbook by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query('SELECT * FROM playbooks WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      tenantOf(req),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
        error: { code: 'NOT_FOUND', message: 'Playbook not found' },
      });
    }

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      playbook: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch playbook');
    next(error);
  }
});

// POST /api/v1/playbooks - Create new playbook
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, trigger_condition, steps } = req.body;
    const tenantId = tenantOf(req);

    const countResult = await pool.query('SELECT COUNT(*) FROM playbooks WHERE tenant_id = $1', [tenantId]);
    const nextNum = parseInt(countResult.rows[0].count) + 1;
    const playbookId = `PB-${String(nextNum).padStart(3, '0')}`;

    const result = await pool.query(
      `INSERT INTO playbooks (playbook_id, name, description, trigger_condition, steps, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [playbookId, name, description, trigger_condition, JSON.stringify(steps || []), tenantId]
    );

    log.info({ playbookId: result.rows[0].id }, 'Playbook created');
    res.status(201).json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      playbook: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to create playbook');
    next(error);
  }
});

// PUT /api/v1/playbooks/:id - Update playbook
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, steps, success_rate } = req.body;

    const result = await pool.query(
      `UPDATE playbooks SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        steps = COALESCE($3, steps),
        success_rate = COALESCE($4, success_rate),
        updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      [name, description, steps, success_rate, req.params.id, tenantOf(req)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
        error: { code: 'NOT_FOUND', message: 'Playbook not found' },
      });
    }

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      playbook: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to update playbook');
    next(error);
  }
});

export function createPlaybookRoutes(): Router {
  return router;
}
