// BLACKSENTINEL AI - Database Migration
//
// This used to hold an 8-migration array covering users/audit_log/alerts/
// incidents/memory_entries/models/conversations/kg_nodes+edges — and a
// runMigrations() that never actually ran any of it. It only logged
// "Running migration N: name" and the first 100 characters of the SQL for
// each entry, then exited. It never imported the database pool, so it
// couldn't have executed anything even if it tried. `npm run db:migrate`
// has never created a single table.
//
// It was also a second, incomplete, drifting copy of the schema —
// database/schema.sql (272 lines, all 12 tables including investigations,
// playbooks, and iocs, which this file never had at all) is the real one.
// Rather than maintain two schema definitions, this just executes that file
// for real.

import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../server/db';
import { logger } from '@blacksentinel/shared/utils/logger';

async function runMigrations() {
  // process.cwd(), not __dirname-relative: __dirname points at wherever this
  // file itself sits (src/database/ when run via tsx, dist/src/database/ when
  // compiled — and tsc never copies schema.sql into dist/ since it's not a
  // .ts file, so a __dirname-relative path breaks in the compiled build).
  // Both Dockerfiles set WORKDIR /app and run from there, so cwd is reliably
  // the project root — same assumption shared/utils/config.ts already makes
  // to find .env.
  const schemaPath = join(process.cwd(), 'database', 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');

  logger.info({ schemaPath }, 'Running database schema...');

  await pool.query(sql);

  logger.info('Schema applied successfully');
}

runMigrations()
  .catch((error) => {
    logger.error({ error }, 'Migration failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
