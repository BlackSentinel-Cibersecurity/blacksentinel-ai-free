// BLACKSENTINEL AI - Investigations Routes (Database-backed)

import { Router, Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { pool } from '../db';
import { tenantOf } from '../utils/tenant';

const log = createChildLogger('routes:investigations');
const router = Router();

// GET /api/v1/investigations - List all investigations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, severity } = req.query;

    let query = 'SELECT * FROM investigations WHERE tenant_id = $1';
    const params: any[] = [tenantOf(req)];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      investigations: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch investigations');
    next(error);
  }
});

// GET /api/v1/investigations/:id - Get investigation by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query('SELECT * FROM investigations WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      tenantOf(req),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
        error: { code: 'NOT_FOUND', message: 'Investigation not found' },
      });
    }

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      investigation: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch investigation');
    next(error);
  }
});

// POST /api/v1/investigations - Create new investigation
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, severity, assigned_to } = req.body;
    const tenantId = tenantOf(req);

    // Generate investigation ID. Scoped to tenant now, but this count-then-
    // insert is still racy under concurrent creates for the same tenant — a
    // duplicate investigation_id would fail the table's UNIQUE constraint
    // (a 500, not silent data corruption) rather than a real sequence.
    const countResult = await pool.query('SELECT COUNT(*) FROM investigations WHERE tenant_id = $1', [tenantId]);
    const nextNum = parseInt(countResult.rows[0].count) + 1;
    const investigationId = `INV-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

    const result = await pool.query(
      `INSERT INTO investigations (investigation_id, title, description, severity, status, assigned_to, tenant_id)
       VALUES ($1, $2, $3, $4, 'active', $5, $6) RETURNING *`,
      [investigationId, title, description, severity || 'medium', assigned_to || null, tenantId]
    );

    log.info({ investigationId: result.rows[0].id }, 'Investigation created');
    res.status(201).json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      investigation: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to create investigation');
    next(error);
  }
});

// PUT /api/v1/investigations/:id - Update investigation
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, severity, findings, evidence } = req.body;

    const result = await pool.query(
      `UPDATE investigations SET
        status = COALESCE($1, status),
        severity = COALESCE($2, severity),
        findings = COALESCE($3, findings),
        evidence = COALESCE($4, evidence),
        updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      [status, severity, findings, evidence, req.params.id, tenantOf(req)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
        error: { code: 'NOT_FOUND', message: 'Investigation not found' },
      });
    }

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      investigation: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to update investigation');
    next(error);
  }
});

export function createInvestigationRoutes(): Router {
  return router;
}
