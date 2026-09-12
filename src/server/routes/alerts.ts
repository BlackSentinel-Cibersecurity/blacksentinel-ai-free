// BLACKSENTINEL AI - Alerts Routes (Database-backed)

import { Router, Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { pool } from '../db';
import { tenantOf } from '../utils/tenant';

const log = createChildLogger('routes:alerts');
const router = Router();

// GET /api/v1/alerts - List all alerts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { severity, status, limit = '50' } = req.query;

    let query = 'SELECT * FROM alerts WHERE tenant_id = $1';
    const params: any[] = [tenantOf(req)];

    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      alerts: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch alerts');
    next(error);
  }
});

// GET /api/v1/alerts/stats - Alert statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'investigating') as investigating_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE severity = 'low') as low
      FROM alerts
      WHERE tenant_id = $1`,
      [tenantOf(req)]
    );

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      stats: stats.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch alert stats');
    next(error);
  }
});

// GET /api/v1/alerts/:id - Get alert by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query('SELECT * FROM alerts WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      tenantOf(req),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      });
    }

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      alert: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch alert');
    next(error);
  }
});

// POST /api/v1/alerts - Create new alert
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, severity, source, mitre_mapping, confidence } = req.body;

    const result = await pool.query(
      `INSERT INTO alerts (title, description, severity, status, source, mitre_mapping, confidence, tenant_id)
       VALUES ($1, $2, $3, 'new', $4, $5, $6, $7) RETURNING *`,
      [title, description, severity || 'medium', source || 'manual', mitre_mapping || null, confidence || 0.5, tenantOf(req)]
    );

    log.info({ alertId: result.rows[0].id }, 'Alert created');
    res.status(201).json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      alert: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to create alert');
    next(error);
  }
});

// PUT /api/v1/alerts/:id - Update alert
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, severity, assigned_to } = req.body;

    const result = await pool.query(
      `UPDATE alerts SET status = COALESCE($1, status), severity = COALESCE($2, severity),
       assigned_to = COALESCE($3, assigned_to), updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [status, severity, assigned_to, req.params.id, tenantOf(req)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      });
    }

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      alert: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to update alert');
    next(error);
  }
});

export function createAlertRoutes(): Router {
  return router;
}
