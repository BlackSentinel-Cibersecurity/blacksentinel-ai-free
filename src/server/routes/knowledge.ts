// BLACKSENTINEL AI - Knowledge Graph Routes (Database-backed)
//
// Backed by `kg_nodes` / `kg_edges` (database/schema.sql). This is a
// relational graph, not a native graph DB (docker-compose wires up Neo4j but
// nothing here talks to it yet) — fine at this scale, but multi-hop traversal
// is done with recursive application-side BFS rather than a Cypher query.

import { Router, Request, Response, NextFunction } from 'express';
import { validateOrThrow, KnowledgeSearchRequestSchema, KnowledgeNodeSchema, KnowledgeEdgeSchema } from '@blacksentinel/shared/utils/validation';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { pool } from '../db';

const log = createChildLogger('routes:knowledge');
const router = Router();

const NODE_TYPE_COLORS: Record<string, string> = {
  entity: BRAND.colors.orange.primary,
  threat: BRAND.colors.critical,
  vulnerability: BRAND.colors.warning,
  asset: BRAND.colors.info,
  person: BRAND.colors.success,
  organization: BRAND.colors.orange.bright,
  malware: BRAND.colors.critical,
  campaign: BRAND.colors.orange.light,
};

function withBrand<T extends Record<string, unknown>>(body: T) {
  return { brand: { logo: BRAND.logo.primary, colors: BRAND.colors }, ...body };
}

function tenantOf(req: Request): string {
  return (req as any).tenantId || 'default';
}

function colorNode(node: KgNodeRow) {
  return { ...node, color: NODE_TYPE_COLORS[node.type] || BRAND.colors.gray.medium };
}

interface KgNodeRow {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
}

interface KgEdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: Record<string, unknown>;
  weight: number;
  created_at: Date;
}

// POST /api/v1/knowledge/search
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(KnowledgeSearchRequestSchema, req.body);
    const tenantId = tenantOf(req);

    const params: unknown[] = [tenantId, `%${validated.query}%`];
    let sql = `SELECT id, type, name, properties, tenant_id, created_at, updated_at
               FROM kg_nodes WHERE tenant_id = $1 AND name ILIKE $2`;

    if (validated.types && validated.types.length > 0) {
      params.push(validated.types);
      sql += ` AND type = ANY($${params.length}::text[])`;
    }

    params.push(validated.limit);
    sql += ` ORDER BY updated_at DESC LIMIT $${params.length}`;

    const nodesResult = await pool.query<KgNodeRow>(sql, params);
    const nodeIds = nodesResult.rows.map((n) => n.id);

    let edges: KgEdgeRow[] = [];
    if (nodeIds.length > 0) {
      const edgesResult = await pool.query<KgEdgeRow>(
        `SELECT id, source_id, target_id, type, properties, weight, created_at
         FROM kg_edges WHERE source_id = ANY($1::uuid[]) OR target_id = ANY($1::uuid[])`,
        [nodeIds]
      );
      edges = edgesResult.rows;
    }

    log.info({ query: validated.query, nodes: nodesResult.rows.length, edges: edges.length }, 'Knowledge graph search');

    res.json(
      withBrand({
        nodes: nodesResult.rows.map(colorNode),
        edges,
        totalResults: nodesResult.rows.length,
        query: validated.query,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    log.error({ error }, 'Knowledge search failed');
    next(error);
  }
});

// GET /api/v1/knowledge/graph/stats
router.get('/graph/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantOf(req);

    const [nodeTypes, edgeTypes, totals] = await Promise.all([
      pool.query<{ type: string; count: number }>(
        `SELECT type, COUNT(*)::int as count FROM kg_nodes WHERE tenant_id = $1 GROUP BY type`,
        [tenantId]
      ),
      pool.query<{ type: string; count: number }>(
        `SELECT e.type, COUNT(*)::int as count FROM kg_edges e
         JOIN kg_nodes n ON n.id = e.source_id
         WHERE n.tenant_id = $1 GROUP BY e.type`,
        [tenantId]
      ),
      pool.query<{ total_nodes: number; total_edges: number }>(
        `SELECT
          (SELECT COUNT(*)::int FROM kg_nodes WHERE tenant_id = $1) as total_nodes,
          (SELECT COUNT(*)::int FROM kg_edges e JOIN kg_nodes n ON n.id = e.source_id WHERE n.tenant_id = $1) as total_edges`,
        [tenantId]
      ),
    ]);

    res.json(
      withBrand({
        totalNodes: totals.rows[0]?.total_nodes || 0,
        totalEdges: totals.rows[0]?.total_edges || 0,
        nodeTypes: Object.fromEntries(nodeTypes.rows.map((r) => [r.type, r.count])),
        edgeTypes: Object.fromEntries(edgeTypes.rows.map((r) => [r.type, r.count])),
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    log.error({ error }, 'Knowledge graph stats failed');
    next(error);
  }
});

// POST /api/v1/knowledge/graph/nodes
router.post('/graph/nodes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(KnowledgeNodeSchema, req.body);
    const tenantId = tenantOf(req);
    const name = (req.body.name as string) || (validated.properties.name as string) || `${validated.type}-node`;

    const result = await pool.query<KgNodeRow>(
      `INSERT INTO kg_nodes (type, name, properties, tenant_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, type, name, properties, tenant_id, created_at, updated_at`,
      [validated.type, name, validated.properties, tenantId]
    );

    log.info({ nodeId: result.rows[0].id, type: validated.type }, 'Node created');
    res.status(201).json(withBrand({ node: colorNode(result.rows[0]) }));
  } catch (error) {
    log.error({ error }, 'Node creation failed');
    next(error);
  }
});

// POST /api/v1/knowledge/graph/edges
router.post('/graph/edges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(KnowledgeEdgeSchema, req.body);

    const result = await pool.query<KgEdgeRow>(
      `INSERT INTO kg_edges (source_id, target_id, type, properties, weight)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, source_id, target_id, type, properties, weight, created_at`,
      [validated.source, validated.target, validated.type, validated.properties ?? {}, 1.0]
    );

    log.info({ edgeId: result.rows[0].id, type: validated.type }, 'Edge created');
    res.status(201).json(withBrand({ edge: { ...result.rows[0], color: BRAND.colors.gray.medium } }));
  } catch (error: any) {
    if (error?.code === '23503') {
      // FK violation: source or target node doesn't exist
      res.status(400).json(
        withBrand({ error: { code: 'INVALID_REFERENCE', message: 'source or target node does not exist' } })
      );
      return;
    }
    log.error({ error }, 'Edge creation failed');
    next(error);
  }
});

// GET /api/v1/knowledge/graph/nodes/:id/neighbors
router.get('/graph/nodes/:id/neighbors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const depth = Math.min(Math.max(parseInt(req.query.depth as string) || 1, 1), 5);

    const visitedNodeIds = new Set<string>([id]);
    const visitedEdgeIds = new Set<string>();
    let frontier = [id];

    for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
      const edgesResult = await pool.query<KgEdgeRow>(
        `SELECT id, source_id, target_id, type, properties, weight, created_at
         FROM kg_edges WHERE source_id = ANY($1::uuid[]) OR target_id = ANY($1::uuid[])`,
        [frontier]
      );

      const nextFrontier: string[] = [];
      for (const edge of edgesResult.rows) {
        visitedEdgeIds.add(edge.id);
        for (const nodeId of [edge.source_id, edge.target_id]) {
          if (!visitedNodeIds.has(nodeId)) {
            visitedNodeIds.add(nodeId);
            nextFrontier.push(nodeId);
          }
        }
      }
      frontier = nextFrontier;
    }

    visitedNodeIds.delete(id);
    const nodeIds = Array.from(visitedNodeIds);

    const [nodesResult, edgesResult] = await Promise.all([
      nodeIds.length > 0
        ? pool.query<KgNodeRow>(`SELECT id, type, name, properties, tenant_id, created_at, updated_at FROM kg_nodes WHERE id = ANY($1::uuid[])`, [nodeIds])
        : Promise.resolve({ rows: [] as KgNodeRow[] }),
      pool.query<KgEdgeRow>(`SELECT id, source_id, target_id, type, properties, weight, created_at FROM kg_edges WHERE id = ANY($1::uuid[])`, [
        Array.from(visitedEdgeIds),
      ]),
    ]);

    res.json(
      withBrand({
        nodeId: id,
        depth,
        nodes: nodesResult.rows.map(colorNode),
        edges: edgesResult.rows,
      })
    );
  } catch (error) {
    log.error({ error }, 'Neighbor lookup failed');
    next(error);
  }
});

export function createKnowledgeRoutes(): Router {
  return router;
}
