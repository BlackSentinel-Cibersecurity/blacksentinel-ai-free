// BLACKSENTINEL AI - XAI Routes
//
// /explain used to return the same fabricated explanation (same "why", same
// evidence about "PowerShell execution" and "botnet infrastructure") for any
// decisionId, including ones that don't exist. There is no `decisions` table
// - nothing about agent decisions is persisted anywhere yet - so there is
// nothing real to explain. Returns 501 rather than inventing a plausible-
// sounding explanation for a decision that may never have happened.

import { Router, Request, Response, NextFunction } from 'express';
import { BRAND } from '@blacksentinel/shared/constants/brand';

const router = Router();

// POST /api/v1/xai/explain
router.post('/explain', async (req: Request, res: Response, next: NextFunction) => {
  res.status(501).json({
    brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'No decisions are persisted anywhere yet (no `decisions` table), so there is nothing real to explain for any decisionId. Previously this returned the same fabricated explanation regardless of whether the id existed.',
    },
  });
});

// GET /api/v1/xai/decisions/:id
router.get('/decisions/:id', async (req: Request, res: Response, next: NextFunction) => {
  res.status(501).json({
    brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Decisions are not persisted yet.',
    },
  });
});

export function createXAIRoutes(): Router {
  return router;
}
