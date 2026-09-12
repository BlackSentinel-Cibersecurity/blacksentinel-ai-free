// BLACKSENTINEL AI - SOC Agent (shared logic)
//
// Extracted so both POST /api/v1/agents/soc/process and POST /api/v1/query
// (which previously had its own, fully disconnected canned response) run the
// same real triage logic grounded in the `alerts` table, instead of two
// different implementations of "the SOC agent" drifting apart.

import { pool } from '../db';

export interface AgentResult {
  answer: string;
  confidence: number;
  reasoning: {
    conclusion: string;
    confidence: number;
    evidence: string[];
    reasoning: string[];
    alternatives: string[];
    limitations: string[];
    risks: string[];
  };
  actions: Array<{ type: string; label: string; alertId?: string }>;
}

interface AlertStatsRow {
  open_count: number;
  critical_count: number;
  high_count: number;
}

interface AlertRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  confidence: number;
  created_at: Date;
}

export async function runSOCAgent(input: { requestId: string; query: string; tenantId: string }): Promise<AgentResult> {
  const statsResult = await pool.query<AlertStatsRow>(
    `SELECT
       COUNT(*) FILTER (WHERE status != 'resolved')::int as open_count,
       COUNT(*) FILTER (WHERE status != 'resolved' AND severity = 'critical')::int as critical_count,
       COUNT(*) FILTER (WHERE status != 'resolved' AND severity = 'high')::int as high_count
     FROM alerts WHERE tenant_id = $1`,
    [input.tenantId]
  );
  const stats = statsResult.rows[0];

  const topAlertsResult = await pool.query<AlertRow>(
    `SELECT id, title, severity, status, source, confidence, created_at
     FROM alerts
     WHERE tenant_id = $1 AND status != 'resolved'
     ORDER BY
       CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT 5`,
    [input.tenantId]
  );

  const openCount: number = stats.open_count;
  const criticalCount: number = stats.critical_count;
  const highCount: number = stats.high_count;

  if (openCount === 0) {
    return {
      answer: 'No open alerts for this tenant right now. The environment reads clean based on current alert data — this reflects what has been ingested, not a guarantee nothing is happening.',
      confidence: 0.55,
      reasoning: {
        conclusion: 'No open alerts found',
        confidence: 0.55,
        evidence: [],
        reasoning: ['Queried `alerts` table for non-resolved rows for this tenant and found none.'],
        alternatives: ['Absence of alerts may reflect a detection gap rather than a quiet environment.'],
        limitations: ['This agent only reasons over alerts already ingested into this platform.'],
        risks: [],
      },
      actions: [],
    };
  }

  const severityLine = criticalCount > 0
    ? `${criticalCount} of them are CRITICAL and need immediate attention.`
    : highCount > 0
    ? `${highCount} are HIGH severity.`
    : 'None are critical or high severity right now.';

  const confidence = Math.min(0.5 + openCount * 0.03 + criticalCount * 0.05, 0.95);

  const evidence = topAlertsResult.rows.map(
    (a) => `[${a.severity.toUpperCase()}] ${a.title} (source: ${a.source}, status: ${a.status})`
  );

  return {
    answer: `${openCount} open alert${openCount === 1 ? '' : 's'} for this tenant. ${severityLine} Top items: ${topAlertsResult.rows
      .slice(0, 3)
      .map((a) => a.title)
      .join('; ')}.`,
    confidence,
    reasoning: {
      conclusion: `${openCount} open alerts, ${criticalCount} critical`,
      confidence,
      evidence,
      reasoning: [
        `Counted non-resolved rows in \`alerts\` for tenant ${input.tenantId}.`,
        'Ranked by severity (critical > high > medium > low), then recency.',
      ],
      alternatives: [],
      limitations: [
        'Correlation is by severity/recency only — no cross-alert entity correlation via the knowledge graph yet.',
        'Confidence is a heuristic based on alert volume, not a calibrated model score.',
      ],
      risks: criticalCount > 0 ? ['Unaddressed critical alerts present'] : [],
    },
    actions: topAlertsResult.rows
      .filter((a) => a.severity === 'critical' || a.severity === 'high')
      .map((a) => ({ type: 'investigate_alert', label: `Investigate: ${a.title}`, alertId: a.id })),
  };
}

export async function persistExchange(input: {
  conversationId: string;
  tenantId: string;
  userId: string;
  query: string;
  answer: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO conversations (id, tenant_id, metadata)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [input.conversationId, input.tenantId, { userId: input.userId }]
  );

  await pool.query(
    `INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
    [input.conversationId, input.query, input.answer]
  );
}
