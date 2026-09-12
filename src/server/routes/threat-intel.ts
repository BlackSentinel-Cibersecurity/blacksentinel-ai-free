// BLACKSENTINEL AI - Threat Intel / IOCs Routes (Database-backed)

import { Router, Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { pool } from '../db';
import { tenantOf } from '../utils/tenant';

const log = createChildLogger('routes:threat-intel');
const router = Router();

// GET /api/v1/threat-intel - List all IOCs
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, threat_type } = req.query;

    let query = 'SELECT * FROM iocs WHERE tenant_id = $1';
    const params: any[] = [tenantOf(req)];

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    if (threat_type) {
      params.push(threat_type);
      query += ` AND threat_type = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      iocs: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch IOCs');
    next(error);
  }
});

// GET /api/v1/threat-intel/stats - IOC statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE type = 'ip') as ip_count,
        COUNT(*) FILTER (WHERE type = 'domain') as domain_count,
        COUNT(*) FILTER (WHERE type = 'hash') as hash_count,
        COUNT(*) FILTER (WHERE type = 'url') as url_count,
        COUNT(*) FILTER (WHERE confidence >= 0.9) as high_confidence
      FROM iocs
      WHERE tenant_id = $1`,
      [tenantOf(req)]
    );

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      stats: stats.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch IOC stats');
    next(error);
  }
});

// POST /api/v1/threat-intel - Create new IOC
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, value, threat_type, confidence, source, description } = req.body;

    const result = await pool.query(
      `INSERT INTO iocs (type, value, threat_type, confidence, source, description, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [type, value, threat_type, confidence || 0.5, source || 'manual', description || null, tenantOf(req)]
    );

    log.info({ iocId: result.rows[0].id }, 'IOC created');
    res.status(201).json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      ioc: result.rows[0],
    });
  } catch (error) {
    log.error({ error }, 'Failed to create IOC');
    next(error);
  }
});

// POST /api/v1/threat-intel/lookup - Lookup IOC value
router.post('/lookup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value } = req.body;

    const result = await pool.query(
      'SELECT * FROM iocs WHERE value = $1 AND tenant_id = $2',
      [value, tenantOf(req)]
    );

    res.json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      found: result.rows.length > 0,
      iocs: result.rows,
    });
  } catch (error) {
    log.error({ error }, 'Failed to lookup IOC');
    next(error);
  }
});

export function createThreatIntelRoutes(): Router {
  return router;
}
