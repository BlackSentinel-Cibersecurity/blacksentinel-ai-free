// BLACKSENTINEL AI - Incident Response Agent
//
// Third real agent (after SOC, Threat Hunter). Grounded in the `incidents`
// and `playbooks` tables: summarizes open incidents by severity, and matches
// each open incident's severity against a playbook whose trigger_condition
// mentions that severity — a plain substring match, not a rules engine, and
// the response says so. No incident has a linked playbook automatically;
// this only *suggests* one, since acting on it should be a human decision.

import { pool } from '../db';
import { AgentResult } from './socAgent';

interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: Date;
}

interface PlaybookRow {
  id: string;
  playbook_id: string;
  name: string;
  trigger_condition: string | null;
  success_rate: number;
}

export async function runIncidentResponseAgent(input: {
  requestId: string;
  query: string;
  tenantId: string;
}): Promise<AgentResult> {
  const [incidentsResult, playbooksResult] = await Promise.all([
    pool.query<IncidentRow>(
      `SELECT id, title, severity, status, created_at
       FROM incidents
       WHERE tenant_id = $1 AND status != 'closed'
       ORDER BY
         CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         created_at ASC
       LIMIT 10`,
      [input.tenantId]
    ),
    pool.query<PlaybookRow>(
      `SELECT id, playbook_id, name, trigger_condition, success_rate
       FROM playbooks WHERE tenant_id = $1`,
      [input.tenantId]
    ),
  ]);

  const incidents = incidentsResult.rows;
  const playbooks = playbooksResult.rows;

  if (incidents.length === 0) {
    return {
      answer: 'No open incidents for this tenant right now.',
      confidence: 0.55,
      reasoning: {
        conclusion: 'No open incidents',
        confidence: 0.55,
        evidence: [],
        reasoning: ["Queried `incidents` for non-closed rows for this tenant and found none."],
        alternatives: [],
        limitations: ['This agent only reasons over incidents already recorded in this platform.'],
        risks: [],
      },
      actions: [],
    };
  }

  const matchPlaybook = (severity: string): PlaybookRow | undefined =>
    playbooks.find((p) => (p.trigger_condition ?? '').toLowerCase().includes(severity.toLowerCase()));

  const critical = incidents.filter((i) => i.severity === 'critical');
  const oldestHours = (Date.now() - incidents[incidents.length - 1].created_at.getTime()) / 3_600_000;

  const evidence = incidents.map((i) => {
    const playbook = matchPlaybook(i.severity);
    return `[${i.severity.toUpperCase()}] ${i.title} — ${playbook ? `matched playbook "${playbook.name}"` : 'no matching playbook'}`;
  });

  const answerParts = [
    `${incidents.length} open incident${incidents.length === 1 ? '' : 's'}.`,
    critical.length > 0 ? `${critical.length} critical.` : '',
    `Oldest has been open ${oldestHours.toFixed(1)}h.`,
  ].filter(Boolean);

  const confidence = Math.min(0.5 + incidents.length * 0.03 + critical.length * 0.05, 0.9);

  return {
    answer: answerParts.join(' '),
    confidence,
    reasoning: {
      conclusion: `${incidents.length} open incidents, ${critical.length} critical`,
      confidence,
      evidence,
      reasoning: [
        `Counted non-closed rows in \`incidents\` for tenant ${input.tenantId}, ranked by severity then age.`,
        `Matched each incident's severity against playbook trigger_condition text (substring match, ${playbooks.length} playbook(s) on file).`,
      ],
      alternatives: [],
      limitations: [
        'Playbook matching is a plain text substring match on trigger_condition, not a rules engine.',
        'This agent suggests a playbook; it does not execute one.',
      ],
      risks: critical.length > 0 ? ['Unaddressed critical incidents present'] : [],
    },
    actions: incidents
      .filter((i) => i.severity === 'critical' || i.severity === 'high')
      .map((i) => {
        const playbook = matchPlaybook(i.severity);
        return {
          type: 'incident_response',
          label: playbook ? `Run playbook "${playbook.name}" for: ${i.title}` : `Investigate (no playbook): ${i.title}`,
          alertId: i.id,
        };
      }),
  };
}
