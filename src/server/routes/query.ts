// BLACKSENTINEL AI - Query Routes
//
// Previously returned a fully canned answer ("The BlackSentinel AI engine
// has processed your query...") regardless of what was asked, and labeled
// it agent: 'soc' without ever running any SOC logic. Now actually runs the
// same real SOC triage used by POST /api/v1/agents/soc/process.

import { Router, Request, Response, NextFunction } from 'express';
import { validateOrThrow, QueryRequestSchema } from '@blacksentinel/shared/utils/validation';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { getConfidenceColor } from '../middleware/brand';
import { runSOCAgent, persistExchange } from '../services/socAgent';

const log = createChildLogger('routes:query');
const router = Router();

// POST /api/v1/query
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const validated = validateOrThrow(QueryRequestSchema, req.body);
    const tenantId = (req as any).tenantId || validated.tenantId;
    const userId = (req as any).userId || validated.userId;
    const conversationId = validated.conversationId || uuidv4();

    log.info({ requestId, query: validated.query.substring(0, 100) }, 'Processing query');

    const result = await runSOCAgent({ requestId, query: validated.query, tenantId });
    await persistExchange({ conversationId, tenantId, userId, query: validated.query, answer: result.answer });

    const response = {
      brand: {
        logo: BRAND.logo.primary,
        colors: BRAND.colors,
      },
      id: requestId,
      answer: result.answer,
      confidence: result.confidence,
      confidenceColor: getConfidenceColor(result.confidence),
      agent: 'soc',
      sources: ['alerts'],
      suggestions: [] as string[],
      visualizations: [] as unknown[],
      actions: result.actions,
      reasoning: result.reasoning,
      conversationId,
      timestamp: new Date().toISOString(),
      latency: Date.now() - startTime,
    };

    log.info({ requestId, latency: response.latency }, 'Query processed');
    res.json(response);
  } catch (error) {
    log.error({ requestId, error }, 'Query processing failed');
    next(error);
  }
});

export function createQueryRoutes(): Router {
  return router;
}
