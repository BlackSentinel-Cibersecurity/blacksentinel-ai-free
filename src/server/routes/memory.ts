// BLACKSENTINEL AI - Memory Routes (Database-backed)
//
// Backed by the `memory_entries` table (database/schema.sql). Relevance is
// currently lexical (ILIKE + a simple score), not vector similarity — the
// `embedding` column exists but nothing populates it yet because there is no
// embedding provider wired in. Swap the lexical WHERE clause below for a
// real pgvector `<->` query once something can produce embeddings; until
// then this is an honest keyword search, not semantic memory.

import { Router, Request, Response, NextFunction } from 'express';
import { validateOrThrow, MemoryStoreRequestSchema, MemoryRetrieveRequestSchema } from '@blacksentinel/shared/utils/validation';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { pool } from '../db';

const log = createChildLogger('routes:memory');
const router = Router();

const MEMORY_TYPE_COLORS: Record<string, string> = {
  immediate: BRAND.colors.orange.primary,
  operational: BRAND.colors.info,
  historical: BRAND.colors.warning,
  organizational: BRAND.colors.success,
  contextual: BRAND.colors.orange.bright,
  investigation: BRAND.colors.critical,
  incident: BRAND.colors.orange.light,
  conversation: BRAND.colors.gray.light,
};

const ALL_MEMORY_TYPES = Object.keys(MEMORY_TYPE_COLORS);

interface MemoryEntryRow {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  tenant_id: string;
  access_count: number;
  relevance_score: number;
  expires_at: Date | null;
  created_at: Date;
}

function withBrand<T extends Record<string, unknown>>(body: T) {
  return { brand: { logo: BRAND.logo.primary, colors: BRAND.colors }, ...body };
}

// POST /api/v1/memory/store
router.post('/store', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(MemoryStoreRequestSchema, req.body);
    // Trust the tenant bound to the caller's verified JWT (set by `authenticate`),
    // never a tenantId the client typed into the body — otherwise any caller
    // could read/write another tenant's memory just by sending a different id.
    const tenantId = (req as any).tenantId || validated.tenantId;

    const result = await pool.query<MemoryEntryRow>(
      `INSERT INTO memory_entries (type, content, metadata, tenant_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, content, metadata, tenant_id, access_count, relevance_score, expires_at, created_at`,
      [
        validated.type,
        validated.content,
        validated.metadata ?? {},
        tenantId,
        validated.expiresAt ?? null,
      ]
    );

    const row = result.rows[0];
    log.info({ entryId: row.id, type: row.type }, 'Memory stored');

    res.status(201).json(
      withBrand({
        entry: { ...row, color: MEMORY_TYPE_COLORS[row.type] || BRAND.colors.gray.medium },
      })
    );
  } catch (error) {
    log.error({ error }, 'Memory store failed');
    next(error);
  }
});

// POST /api/v1/memory/retrieve
router.post('/retrieve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(MemoryRetrieveRequestSchema, req.body);
    const tenantId = (req as any).tenantId || validated.tenantId;

    const params: unknown[] = [tenantId, `%${validated.query}%`];
    let sql = `SELECT id, type, content, metadata, tenant_id, access_count, relevance_score, expires_at, created_at
               FROM memory_entries
               WHERE tenant_id = $1
                 AND content ILIKE $2
                 AND (expires_at IS NULL OR expires_at > NOW())
                 AND relevance_score >= $3`;
    params.push(validated.minRelevance);

    if (validated.types && validated.types.length > 0) {
      params.push(validated.types);
      sql += ` AND type = ANY($${params.length}::text[])`;
    }

    params.push(validated.limit);
    sql += ` ORDER BY relevance_score DESC, created_at DESC LIMIT $${params.length}`;

    const result = await pool.query<MemoryEntryRow>(sql, params);

    if (result.rows.length > 0) {
      const ids = result.rows.map((r) => r.id);
      await pool.query(
        `UPDATE memory_entries SET access_count = access_count + 1 WHERE id = ANY($1::uuid[])`,
        [ids]
      );
    }

    log.info({ query: validated.query, results: result.rows.length }, 'Memory retrieved');

    res.json(
      withBrand({
        entries: result.rows.map((r) => ({ ...r, color: MEMORY_TYPE_COLORS[r.type] || BRAND.colors.gray.medium })),
        totalFound: result.rows.length,
        query: validated.query,
        matchStrategy: 'lexical', // honest label: not semantic/vector search yet
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    log.error({ error }, 'Memory retrieve failed');
    next(error);
  }
});

// GET /api/v1/memory/stats
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId || 'default';

    const result = await pool.query<{ type: string; count: number }>(
      `SELECT type, COUNT(*)::int as count FROM memory_entries WHERE tenant_id = $1 GROUP BY type`,
      [tenantId]
    );
    const countsByType = new Map(result.rows.map((r) => [r.type, r.count]));

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int as total FROM memory_entries WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json(
      withBrand({
        layers: ALL_MEMORY_TYPES.map((name) => ({
          name,
          count: countsByType.get(name) || 0,
          color: MEMORY_TYPE_COLORS[name],
        })),
        totalEntries: totalResult.rows[0]?.total || 0,
        vectorStoreSize: 0, // honest: no vector store wired up yet, see module header
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    log.error({ error }, 'Memory stats failed');
    next(error);
  }
});

// DELETE /api/v1/memory/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).tenantId || 'default';
    const result = await pool.query(
      `DELETE FROM memory_entries WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(
        withBrand({ error: { code: 'NOT_FOUND', message: 'Memory entry not found' } })
      );
    }

    log.info({ entryId: req.params.id }, 'Memory deleted');
    res.status(204).send();
  } catch (error) {
    log.error({ error }, 'Memory delete failed');
    next(error);
  }
});

export function createMemoryRoutes(): Router {
  return router;
}
