// BLACKSENTINEL AI - First-start database setup
//
// Under docker compose nothing ever ran database/schema.sql (the postgres
// service has no init script and `npm run db:migrate` is a manual step), so
// the engine started with no tables and every sign-in failed. The schema is
// idempotent (CREATE ... IF NOT EXISTS throughout), so it is applied on every
// start.
//
// SECURITY FIX: schema.sql also seeded admin@blacksentinel.ai with the
// password 'Admin123!', which the login page even printed as a hint. The first
// admin is now created here, only when there are no users, with ADMIN_PASSWORD
// (12+ characters) or a random password printed once in this log.

import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import type { Logger } from 'pino';

export async function bootstrapDatabase(pool: Pool, log: Pick<Logger, 'info' | 'warn'>): Promise<void> {
  const schema = readFileSync(join(process.cwd(), 'database', 'schema.sql'), 'utf8');
  await pool.query(schema);

  const { rows } = await pool.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return;

  const email = process.env.ADMIN_EMAIL?.trim() || 'admin@blacksentinel.ai';
  const configured = process.env.ADMIN_PASSWORD?.trim();
  const fromEnv = !!configured && configured.length >= 12;
  const password = fromEnv ? configured! : randomBytes(12).toString('base64url');

  await pool.query(
    `INSERT INTO users (email, name, password_hash, role, company, tenant_id)
     VALUES ($1, 'Administrator', $2, 'admin', 'BlackSentinel AI', 'default')
     ON CONFLICT (email) DO NOTHING`,
    [email, await bcrypt.hash(password, 12)]
  );

  if (fromEnv) {
    log.info({ email }, 'First admin created (password from ADMIN_PASSWORD)');
  } else {
    log.warn(`First admin created: ${email} / ${password}  <- shown only this once; sign in and change it.`);
  }
}
