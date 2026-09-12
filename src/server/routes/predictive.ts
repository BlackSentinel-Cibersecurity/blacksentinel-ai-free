// BLACKSENTINEL AI - Predictive Routes
//
// Every endpoint here used to return the same hardcoded predictions
// ("Ransomware Campaign", 65% probability, every single time, for every
// tenant, regardless of input) as if a real model produced them. There is no
// trained model, no historical training data, and no LLM provider configured
// (LLM_API_KEY is unset) to back this. Serving fabricated probabilities
// labeled as predictions is worse than refusing, especially for a security
// product a customer might actually act on — so these now return 501 until
// there's a real model or LLM integration behind them.

import { Router, Request, Response, NextFunction } from 'express';
import { BRAND } from '@blacksentinel/shared/constants/brand';

const router = Router();

function notImplemented(feature: string) {
  return (req: Request, res: Response) => {
    res.status(501).json({
      brand: { logo: BRAND.logo.primary, colors: BRAND.colors },
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `${feature} has no real model behind it yet (no training data, no LLM provider configured). Previously this returned the same hardcoded prediction for every request, which is worse than refusing.`,
      },
    });
  };
}

router.post('/threats', notImplemented('Threat prediction'));
router.post('/exploit', notImplemented('Exploit probability prediction'));
router.post('/attack-paths', notImplemented('Attack path prediction'));
router.post('/risk', notImplemented('Risk scoring'));

export function createPredictiveRoutes(): Router {
  return router;
}
