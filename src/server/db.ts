// BLACKSENTINEL AI - PostgreSQL Database Connection
//
// Used to ignore POSTGRES_URL entirely and build the connection from
// DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD instead — but POSTGRES_URL is
// what docker-compose.yml, the Kubernetes secret, the Helm chart, and
// .github/workflows/ci-cd.yml's integration-test step all actually set.
// This "worked" locally only because db.ts's hardcoded defaults
// (host "postgres", db "blacksentinel", user "bsadmin", password
// "blacksentinel") happen to match docker-compose's postgres service by
// coincidence. In CI (test/test/blacksentinel_test) or any real deployment
// with different credentials, this would have silently connected to the
// wrong database or failed outright. Now parses POSTGRES_URL for real when
// it's set, and only falls back to the individual DB_* vars if it isn't.
import { Pool } from 'pg';

function buildPoolConfig() {
  if (process.env.POSTGRES_URL) {
    return { connectionString: process.env.POSTGRES_URL };
  }
  return {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'blacksentinel',
    user: process.env.DB_USER || 'bsadmin',
    password: process.env.DB_PASSWORD || 'blacksentinel',
  };
}

const pool = new Pool({
  ...buildPoolConfig(),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

export { pool };
