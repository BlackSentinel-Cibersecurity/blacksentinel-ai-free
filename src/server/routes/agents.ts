// BLACKSENTINEL AI - Agent Routes
//
// `soc` and `threat_hunter` are real (query real tables and reason over
// actual rows, then persist the exchange to `conversations` /
// `conversation_messages`). Every other agent type previously returned a
// canned "Agent X processed: ..." string with a hardcoded 0.8 confidence
// regardless of what was asked — that was pure decoration, so callers get an
// honest 501 for those until they get the same treatment.

import { Router, Request, Response, NextFunction } from 'express';
import { validateOrThrow, AgentRequestSchema } from '@blacksentinel/shared/utils/validation';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { getConfidenceColor, getStatusColor } from '../middleware/brand';
import { runSOCAgent, persistExchange, AgentResult } from '../services/socAgent';
import { runThreatHunterAgent } from '../services/threatHunterAgent';
import { runIncidentResponseAgent } from '../services/incidentResponseAgent';
import { editionConfig } from '../config/edition';
import { pool } from '../db';

const log = createChildLogger('routes:agents');
const router = Router();

const AGENT_TYPES = [
  'soc', 'threat_hunter', 'incident_response', 'threat_intelligence',
  'vulnerability', 'identity', 'endpoint', 'cloud', 'executive', 'automation',
];

type AgentHandler = (input: { requestId: string; query: string; tenantId: string }) => Promise<AgentResult>;

const AGENT_HANDLERS: Partial<Record<string, AgentHandler>> = {
  soc: runSOCAgent,
  threat_hunter: runThreatHunterAgent,
  incident_response: runIncidentResponseAgent,
};

const IMPLEMENTED_AGENTS = new Set(Object.keys(AGENT_HANDLERS));

const AGENT_COLORS: Record<string, string> = {
  soc: BRAND.colors.orange.primary,
  threat_hunter: BRAND.colors.critical,
  incident_response: BRAND.colors.warning,
  threat_intelligence: BRAND.colors.info,
  vulnerability: BRAND.colors.orange.bright,
  identity: BRAND.colors.success,
  endpoint: BRAND.colors.orange.light,
  cloud: BRAND.colors.info,
  executive: BRAND.colors.warning,
  automation: BRAND.colors.success,
};

function withBrand<T extends Record<string, unknown>>(body: T) {
  return { brand: { logo: BRAND.logo.primary, colors: BRAND.colors }, ...body };
}

function tenantOf(req: Request): string {
  return (req as any).tenantId || 'default';
}

// GET /api/v1/agents/status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  const statuses = AGENT_TYPES.map((type) => ({
    type,
    implemented: IMPLEMENTED_AGENTS.has(type),
    status: IMPLEMENTED_AGENTS.has(type) ? 'idle' : 'not_implemented',
    color: AGENT_COLORS[type] || BRAND.colors.gray.medium,
    statusColor: getStatusColor(IMPLEMENTED_AGENTS.has(type) ? 'inactive' : 'error'),
    taskCount: 0,
    lastActive: new Date().toISOString(),
  }));

  res.json(withBrand({ agents: statuses }));
});

// POST /api/v1/agents/:agentType/process
router.post('/:agentType/process', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  const { agentType } = req.params;

  if (!AGENT_TYPES.includes(agentType)) {
    return res.status(400).json(
      withBrand({ error: { code: 'INVALID_AGENT', message: `Invalid agent type: ${agentType}` } })
    );
  }

  if (!IMPLEMENTED_AGENTS.has(agentType)) {
    return res.status(501).json(
      withBrand({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: `The ${agentType} agent has no real analysis logic yet — it is on the roadmap after 'soc'. Returning a canned answer here would be misleading, so this endpoint refuses instead.`,
        },
      })
    );
  }

  try {
    const validated = validateOrThrow(AgentRequestSchema, req.body);
    const tenantId = tenantOf(req);
    const userId = (req as any).userId || validated.userId || 'system';
    const conversationId = (req.body.conversationId as string) || uuidv4();

    if (editionConfig.limits.maxQueriesPerMonth !== Infinity) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM conversation_messages cm
         JOIN conversations c ON c.id = cm.conversation_id
         WHERE c.tenant_id = $1 AND cm.role = 'user' AND cm.created_at > NOW() - INTERVAL '30 days'`,
        [tenantId],
      );
      const currentCount = parseInt(rows[0].count, 10);
      if (currentCount >= editionConfig.limits.maxQueriesPerMonth) {
        return res.status(403).json(
          withBrand({
            error: {
              code: 'PLAN_LIMIT_EXCEEDED',
              message: `Free plan is limited to ${editionConfig.limits.maxQueriesPerMonth} agent queries per 30 days. Upgrade to continue.`,
            },
          })
        );
      }
    }

    log.info({ requestId, agentType, query: validated.query.substring(0, 100) }, 'Processing agent query');

    const handler = AGENT_HANDLERS[agentType]!;
    const response = await handler({ requestId, query: validated.query, tenantId });

    await persistExchange({ conversationId, tenantId, userId, query: validated.query, answer: response.answer });

    log.info({ requestId, agentType, confidence: response.confidence }, 'Agent query processed');

    res.json(
      withBrand({
        id: requestId,
        agent: agentType,
        agentColor: AGENT_COLORS[agentType],
        conversationId,
        answer: response.answer,
        confidence: response.confidence,
        confidenceColor: getConfidenceColor(response.confidence),
        reasoning: response.reasoning,
        actions: response.actions,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    log.error({ requestId, agentType, error }, 'Agent processing failed');
    next(error);
  }
});

export function createAgentRoutes(): Router {
  return router;
}
