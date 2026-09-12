// BLACKSENTINEL AI - Database Seed
//
// Previously logged "Created admin user" / "Created 5 sample alerts" /
// "Created 5 sample knowledge graph nodes" / "Created 4 sample playbooks"
// without ever calling pool.query — none of it was ever inserted anywhere.
// The admin user is already seeded for real by database/schema.sql's own
// INSERT (run via `npm run db:migrate`); this now inserts the sample
// alerts/nodes/playbooks for real, for a working local dev / demo
// environment instead of an empty one.

import { pool } from '../server/db';
import { logger } from '@blacksentinel/shared/utils/logger';

const TENANT_ID = 'default';

async function seed() {
  logger.info('Seeding database...');

  const sampleAlerts = [
    { title: 'Suspicious PowerShell Execution', severity: 'high', source: 'EDR' },
    { title: 'Brute Force Login Attempts', severity: 'medium', source: 'SIEM' },
    { title: 'Malware Detection', severity: 'critical', source: 'AV' },
    { title: 'Unusual Network Traffic', severity: 'medium', source: 'Network' },
    { title: 'Privilege Escalation Attempt', severity: 'high', source: 'EDR' },
  ];

  for (const alert of sampleAlerts) {
    await pool.query(
      `INSERT INTO alerts (title, severity, status, source, tenant_id) VALUES ($1, $2, 'new', $3, $4)`,
      [alert.title, alert.severity, alert.source, TENANT_ID]
    );
  }
  logger.info({ count: sampleAlerts.length }, 'Inserted sample alerts');

  const sampleNodes: Array<{ type: string; name: string; properties: Record<string, unknown> }> = [
    { type: 'server', name: 'web-server-01', properties: { ip: '10.0.1.10', criticality: 'high' } },
    { type: 'server', name: 'db-server-01', properties: { ip: '10.0.1.20', criticality: 'critical' } },
    { type: 'user', name: 'john.doe', properties: { department: 'engineering', role: 'developer' } },
    { type: 'vulnerability', name: 'CVE-2024-1234', properties: { cvss: 9.8, severity: 'critical' } },
    { type: 'alert', name: 'Suspicious Activity', properties: { severity: 'high' } },
  ];

  for (const node of sampleNodes) {
    await pool.query(
      `INSERT INTO kg_nodes (type, name, properties, tenant_id) VALUES ($1, $2, $3, $4)`,
      [node.type, node.name, JSON.stringify(node.properties), TENANT_ID]
    );
  }
  logger.info({ count: sampleNodes.length }, 'Inserted sample knowledge graph nodes');

  const samplePlaybooks = [
    { id: 'PB-001', name: 'Ransomware Response', trigger: 'severity == critical' },
    { id: 'PB-002', name: 'Phishing Investigation', trigger: 'source == email' },
    { id: 'PB-003', name: 'Data Breach Response', trigger: 'severity == critical' },
    { id: 'PB-004', name: 'DDoS Mitigation', trigger: 'source == network' },
  ];

  for (const playbook of samplePlaybooks) {
    await pool.query(
      `INSERT INTO playbooks (playbook_id, name, trigger_condition, tenant_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (playbook_id) DO NOTHING`,
      [playbook.id, playbook.name, playbook.trigger, TENANT_ID]
    );
  }
  logger.info({ count: samplePlaybooks.length }, 'Inserted sample playbooks');

  logger.info('Database seeding complete');
}

seed()
  .catch((error) => {
    logger.error({ error }, 'Seeding failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
