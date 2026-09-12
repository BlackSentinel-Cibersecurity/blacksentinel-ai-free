// BLACKSENTINEL AI - Authentication Middleware

import { Request, Response, NextFunction } from 'express';
import { cryptoUtils } from '@blacksentinel/shared/utils/crypto';
import { AuthenticationError, AuthorizationError } from '@blacksentinel/shared/utils/errors';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';

const log = createChildLogger('middleware:auth');

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('Missing or invalid authorization header'));
  }

  const token = authHeader.substring(7);

  try {
    const payload = cryptoUtils.verifyToken(token);

    (req as any).userId = payload.userId;
    (req as any).tenantId = payload.tenantId;
    (req as any).role = payload.role;
    (req as any).permissions = payload.permissions || [];

    log.debug({ userId: payload.userId }, 'User authenticated');
    next();
  } catch (error) {
    next(new AuthenticationError('Invalid or expired token'));
  }
}

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return next(new AuthorizationError(`Requires one of: ${allowedRoles.join(', ')}`));
    }

    next();
  };
}
