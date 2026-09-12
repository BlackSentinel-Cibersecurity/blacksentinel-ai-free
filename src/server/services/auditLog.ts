// BLACKSENTINEL AI - Audit Log
//
// The `audit_log` table has existed in database/schema.sql since the first
// commit, and the README lists "Immutable audit logging" as a security
// feature, but nothing in src/server ever wrote to it — the only reference
// anywhere was the migration that creates the table. Wired in here,
// starting with authentication events (the highest-value class to audit for
// a security product), not a blanket instrumentation of every route.
//
// "Immutable" is a claim about the log, not enforced by this helper alone —
// enforcing it for real means restricting UPDATE/DELETE on this table at the
// database role level (a migration/ops task, not application code), and
// possibly a hash chain over entries for tamper-evidence. Noted, not done
// here.

import { Request } from 'express';
import { pool } from '../db';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';

const log = createChildLogger('audit');

export async function writeAudit(entry: {
  action: string;
  actor: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  tenantId: string;
  req?: Request;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (action, actor, resource, resource_id, details, tenant_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.action,
        entry.actor,
        entry.resource,
        entry.resourceId ?? null,
        JSON.stringify(entry.details ?? {}),
        entry.tenantId,
        entry.req?.ip ?? null,
        entry.req?.headers['user-agent'] ?? null,
      ]
    );
  } catch (error) {
    // An audit-log write failure should never break the request it's
    // auditing (e.g. a login shouldn't fail because logging it failed) —
    // log loudly instead, since a silent audit gap is its own problem.
    log.error({ error, entry }, 'Failed to write audit log entry');
  }
}
