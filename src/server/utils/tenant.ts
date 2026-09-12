// BLACKSENTINEL AI - Tenant resolution helper
//
// Always prefer the tenant bound to the caller's verified JWT (set by the
// `authenticate` middleware) over anything a client could put in a request
// body or query string — otherwise any caller could read/write another
// tenant's data just by changing a field in their own request.

import { Request } from 'express';

export function tenantOf(req: Request): string {
  return (req as any).tenantId || 'default';
}
