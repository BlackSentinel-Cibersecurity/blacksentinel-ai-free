// BLACKSENTINEL AI - Report Routes (Database-backed, partially)
//
// The CISO report used to be 100% hardcoded, down to specific numbers
// ("15 incidents", "42 vulnerabilities", a 85/100 "security score") and
// literal compliance audit dates from 2024 that would never change no
// matter what was in the database. Real alert/incident counts are now
// pulled from Postgres. There is deliberately no vulnerability count, asset
// count, per-category risk score, or compliance status in this response
// anymore — those need tables this schema doesn't have yet (vulnerabilities,
// assets, compliance_audits). Fabricating specific-looking numbers for them
// would be worse than omitting them; `dataGaps` says so explicitly instead.

import { Router, Request, Response, NextFunction } from 'express';
import { validateOrThrow, ReportRequestSchema } from '@blacksentinel/shared/utils/validation';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { getSeverityColor } from '../middleware/brand';
import { pool } from '../db';

const log = createChildLogger('routes:reports');
const router = Router();

function withBrand<T extends Record<string, unknown>>(body: T) {
  return { brand: { logo: BRAND.logo.primary, colors: BRAND.colors }, ...body };
}

function tenantOf(req: Request): string {
  return (req as any).tenantId || 'default';
}

const DATA_GAPS = [
  'No vulnerability inventory table exists yet — openVulnerabilities is not reported rather than guessed.',
  'No asset inventory table exists yet — assetsMonitored is not reported.',
  'No per-category (network/endpoint/identity/cloud) scoring exists — a single fabricated breakdown was removed rather than kept.',
  'No compliance/audit tracking table exists — SOC2/ISO27001/GDPR status is not reported.',
];

// POST /api/v1/reports/ciso
router.post('/ciso', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(ReportRequestSchema, req.body);
    const tenantId = tenantOf(req);

    const [alertStats, incidentStats, mttr] = await Promise.all([
      pool.query<{ open: number; critical: number; high: number; resolved_24h: number }>(
        `SELECT
           COUNT(*) FILTER (WHERE status != 'resolved')::int as open,
           COUNT(*) FILTER (WHERE status != 'resolved' AND severity = 'critical')::int as critical,
           COUNT(*) FILTER (WHERE status != 'resolved' AND severity = 'high')::int as high,
           COUNT(*) FILTER (WHERE status = 'resolved' AND updated_at > NOW() - INTERVAL '24 hours')::int as resolved_24h
         FROM alerts WHERE tenant_id = $1`,
        [tenantId]
      ),
      pool.query<{ open: number; critical: number }>(
        `SELECT
           COUNT(*) FILTER (WHERE status != 'closed')::int as open,
           COUNT(*) FILTER (WHERE status != 'closed' AND severity = 'critical')::int as critical
         FROM incidents WHERE tenant_id = $1`,
        [tenantId]
      ),
      pool.query<{ avg_hours: number | null }>(
        `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)::float as avg_hours
         FROM alerts WHERE tenant_id = $1 AND status = 'resolved' AND updated_at > NOW() - INTERVAL '30 days'`,
        [tenantId]
      ),
    ]);

    const a = alertStats.rows[0];
    const inc = incidentStats.rows[0];
    const avgResolutionHours = mttr.rows[0]?.avg_hours;

    const overallRisk = a.critical > 0 ? 'critical' : a.high > 0 ? 'high' : a.open > 0 ? 'medium' : 'low';

    const report = withBrand({
      id: uuidv4(),
      executiveSummary: `${a.open} open alert${a.open === 1 ? '' : 's'} (${a.critical} critical, ${a.high} high), ${inc.open} open incident${inc.open === 1 ? '' : 's'}. ${a.resolved_24h} alert${a.resolved_24h === 1 ? '' : 's'} resolved in the last 24 hours.`,
      keyMetrics: {
        openAlerts: a.open,
        criticalAlerts: a.critical,
        highAlerts: a.high,
        openIncidents: inc.open,
        criticalIncidents: inc.critical,
        resolvedLast24h: a.resolved_24h,
        meanTimeToResolveHours: avgResolutionHours !== null && avgResolutionHours !== undefined
          ? Math.round(avgResolutionHours * 10) / 10
          : null,
      },
      riskAssessment: {
        overall: overallRisk,
        overallColor: getSeverityColor(overallRisk),
        basis: 'Derived from open alert/incident severity counts only (no asset criticality weighting yet).',
      },
      recommendations: buildRecommendations(a, inc),
      dataGaps: DATA_GAPS,
      generatedAt: new Date().toISOString(),
      period: validated.period || 'current',
    });

    log.info({ reportId: report.id }, 'CISO report generated');
    res.json(report);
  } catch (error) {
    log.error({ error }, 'Report generation failed');
    next(error);
  }
});

function buildRecommendations(
  a: { open: number; critical: number; high: number },
  inc: { open: number; critical: number }
): string[] {
  const recs: string[] = [];
  if (a.critical > 0) recs.push(`Triage ${a.critical} critical alert${a.critical === 1 ? '' : 's'} immediately.`);
  if (inc.critical > 0) recs.push(`${inc.critical} critical incident${inc.critical === 1 ? '' : 's'} still open — escalate if past SLA.`);
  if (a.high > 0) recs.push(`${a.high} high-severity alert${a.high === 1 ? '' : 's'} pending review.`);
  if (recs.length === 0) recs.push('No critical or high-severity items open right now.');
  return recs;
}

// GET /api/v1/reports
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  // No report-generation history is persisted yet (no `reports` table) —
  // an empty list is honest; the three fake "recent reports" that used to
  // be hardcoded here (with a literal 2024-01-15 timestamp) were not.
  res.json(withBrand({ reports: [], note: 'Report generation history is not persisted yet.' }));
});

export function createReportRoutes(): Router {
  return router;
}
