// BLACKSENTINEL AI - Threat Hunter Agent
//
// Real hunting logic, same honesty bar as the SOC agent: grounded in actual
// rows from `alerts` and `iocs`, not canned text. Two concrete hunts:
//   1. IOC correlation — do any high-confidence indicators of compromise show
//      up (by substring match) in an alert's title/description/source?
//   2. Campaign detection — is one source producing an unusual burst of
//      alerts in a short window, which often indicates a single actor/tool
//      rather than N unrelated incidents?
// Both are simple, explainable heuristics — not ML — and the response says
// so plainly rather than dressing them up as something they're not.

import { pool } from '../db';
import { AgentResult } from './socAgent';

interface AlertRow {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  source: string;
  created_at: Date;
}

interface IocRow {
  id: string;
  type: string;
  value: string;
  threat_type: string | null;
  confidence: number;
}

const CAMPAIGN_THRESHOLD = 3; // alerts from the same source within the window

export async function runThreatHunterAgent(input: {
  requestId: string;
  query: string;
  tenantId: string;
}): Promise<AgentResult> {
  const [alertsResult, iocsResult] = await Promise.all([
    pool.query<AlertRow>(
      `SELECT id, title, description, severity, source, created_at
       FROM alerts
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC
       LIMIT 200`,
      [input.tenantId]
    ),
    pool.query<IocRow>(
      `SELECT id, type, value, threat_type, confidence
       FROM iocs
       WHERE tenant_id = $1 AND confidence >= 0.7
       ORDER BY confidence DESC
       LIMIT 200`,
      [input.tenantId]
    ),
  ]);

  const alerts = alertsResult.rows;
  const iocs = iocsResult.rows;

  // --- Hunt 1: IOC correlation ---
  const iocMatches: Array<{ alert: AlertRow; ioc: IocRow }> = [];
  for (const alert of alerts) {
    const haystack = `${alert.title} ${alert.description ?? ''} ${alert.source}`.toLowerCase();
    for (const ioc of iocs) {
      if (ioc.value.length >= 4 && haystack.includes(ioc.value.toLowerCase())) {
        iocMatches.push({ alert, ioc });
      }
    }
  }

  // --- Hunt 2: campaign detection (burst from one source) ---
  const bySource = new Map<string, AlertRow[]>();
  for (const alert of alerts) {
    const list = bySource.get(alert.source) ?? [];
    list.push(alert);
    bySource.set(alert.source, list);
  }
  const campaigns = Array.from(bySource.entries())
    .filter(([, list]) => list.length >= CAMPAIGN_THRESHOLD)
    .sort((a, b) => b[1].length - a[1].length);

  if (alerts.length === 0) {
    return {
      answer: 'No alerts in the last 7 days for this tenant to hunt over.',
      confidence: 0.5,
      reasoning: {
        conclusion: 'No data to hunt in',
        confidence: 0.5,
        evidence: [],
        reasoning: ["Queried `alerts` for the last 7 days and found none."],
        alternatives: [],
        limitations: ['This hunt only looks at the last 7 days of alerts and IOCs already ingested into this platform.'],
        risks: [],
      },
      actions: [],
    };
  }

  const parts: string[] = [];
  if (iocMatches.length > 0) {
    parts.push(`${iocMatches.length} alert${iocMatches.length === 1 ? '' : 's'} match${iocMatches.length === 1 ? 'es' : ''} a known high-confidence IOC.`);
  }
  if (campaigns.length > 0) {
    const [topSource, topAlerts] = campaigns[0];
    parts.push(`Possible campaign: ${topAlerts.length} alerts from source "${topSource}" in the last 7 days.`);
  }
  if (parts.length === 0) {
    parts.push(`Checked ${alerts.length} alert${alerts.length === 1 ? '' : 's'} against ${iocs.length} known IOC${iocs.length === 1 ? '' : 's'} — no IOC matches or unusual bursts found.`);
  }

  const confidence = Math.min(0.5 + iocMatches.length * 0.08 + campaigns.length * 0.1, 0.95);

  const evidence = [
    ...iocMatches.slice(0, 5).map(
      (m) => `IOC match: "${m.alert.title}" contains ${m.ioc.type} indicator "${m.ioc.value}" (${m.ioc.threat_type ?? 'unclassified'}, confidence ${m.ioc.confidence})`
    ),
    ...campaigns.slice(0, 3).map(([source, list]) => `Burst: ${list.length} alerts from "${source}" in 7 days`),
  ];

  return {
    answer: parts.join(' '),
    confidence,
    reasoning: {
      conclusion: `${iocMatches.length} IOC match(es), ${campaigns.length} possible campaign(s)`,
      confidence,
      evidence,
      reasoning: [
        `Correlated ${alerts.length} alerts from the last 7 days against ${iocs.length} IOCs with confidence >= 0.7 (substring match on title/description/source).`,
        `Flagged sources with ${CAMPAIGN_THRESHOLD}+ alerts in the window as possible single-actor campaigns.`,
      ],
      alternatives: [],
      limitations: [
        'IOC correlation is a plain substring match, not fuzzy/defanged-indicator matching (e.g. "1[.]2[.]3[.]4" won\'t match "1.2.3.4").',
        'Campaign detection only looks at alert source, not entity/asset overlap via the knowledge graph.',
      ],
      risks: iocMatches.length > 0 ? ['Confirmed IOC presence in recent alerts'] : [],
    },
    actions: [
      ...iocMatches.slice(0, 5).map((m) => ({ type: 'investigate_alert', label: `Investigate IOC match: ${m.alert.title}`, alertId: m.alert.id })),
    ],
  };
}
