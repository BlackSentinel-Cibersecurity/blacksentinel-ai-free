// BLACKSENTINEL AI - Request Logger Middleware

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';

const log = createChildLogger('middleware:request');

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = uuidv4();
  const startTime = Date.now();

  (req as any).requestId = requestId;

  res.setHeader('X-Request-Id', requestId);

  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const latency = Date.now() - startTime;
    log.info({
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      latency,
      userId: (req as any).userId,
    }, 'Request completed');
    return originalJson(body);
  };

  next();
}
