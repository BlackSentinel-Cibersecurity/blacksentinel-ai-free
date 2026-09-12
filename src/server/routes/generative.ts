// BLACKSENTINEL AI - Generative AI Routes
//
// Previously returned a placeholder string ("Generated sigma artifact:
// Untitled") instead of an actual rule/query/script, even though
// packages/generative-ai has real Sigma/YARA/Suricata/KQL/SQL/playbook/
// script/report generators - they were just never imported by the live
// server. Now they are. These are template generators (no LLM call), so the
// content is deterministic given the input, not "AI-generated" in the sense
// of an LLM writing it - the warnings below say that plainly rather than
// oversell it.

import { Router, Request, Response, NextFunction } from 'express';
import { validateOrThrow, GenerationRequestSchema } from '@blacksentinel/shared/utils/validation';
import { createChildLogger } from '@blacksentinel/shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { getConfidenceColor } from '../middleware/brand';
import { GenerativeAIEngine, GenerationRequest } from '../services/generativeEngine';

const log = createChildLogger('routes:generative');
const router = Router();

const ARTIFACT_TYPE_COLORS: Record<string, string> = {
  sigma: BRAND.colors.orange.primary,
  yara: BRAND.colors.critical,
  suricata: BRAND.colors.warning,
  kql: BRAND.colors.info,
  sql: BRAND.colors.gray.light,
  playbook: BRAND.colors.success,
  powershell: BRAND.colors.orange.bright,
  bash: BRAND.colors.orange.light,
  python: BRAND.colors.info,
  runbook: BRAND.colors.warning,
  report: BRAND.colors.gray.medium,
};

const engine = new GenerativeAIEngine({
  sigma: { templates: [] },
  yara: { maxRuleLength: 10000 },
  suricata: { defaultRules: [] },
  kql: { defaultTables: [] },
  sql: { dialect: 'postgres' },
  playbook: { templates: [] },
  script: { languages: ['powershell', 'bash', 'python'] },
  report: { templates: [] },
});

function withBrand<T extends Record<string, unknown>>(body: T) {
  return { brand: { logo: BRAND.logo.primary, colors: BRAND.colors }, ...body };
}

// POST /api/v1/generative/generate
router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = validateOrThrow(GenerationRequestSchema, req.body);
    const tenantId = (req as any).tenantId || validated.tenantId;
    const userId = (req as any).userId || validated.userId;

    log.info({ type: validated.type, title: validated.title }, 'Generating artifact');

    // The Zod schema only validates the fields common to every artifact type;
    // type-specific inputs (yaraStrings, kqlTable, suricataContent, ...) pass
    // through from the raw body since they're free-text template parameters,
    // not new attack surface beyond what title/description already accept.
    const request: GenerationRequest = {
      ...(req.body as Record<string, unknown>),
      ...validated,
      tenantId,
      userId,
    } as GenerationRequest;

    const result = await engine.generate(request);

    log.info({ id: result.id, type: result.type }, 'Artifact generated');
    res.json(
      withBrand({
        id: result.id,
        type: result.type,
        color: ARTIFACT_TYPE_COLORS[result.type] || BRAND.colors.gray.medium,
        content: result.content,
        format: result.format,
        confidence: result.confidence,
        confidenceColor: getConfidenceColor(result.confidence),
        warnings: [...result.warnings, 'This is a deterministic template generator, not an LLM — review still required.'],
        recommendations: result.recommendations,
        latency: result.latency,
        generatedAt: result.generatedAt.toISOString(),
        tenantId: result.tenantId,
        userId: result.userId,
      })
    );
  } catch (error) {
    log.error({ error }, 'Generation failed');
    next(error);
  }
});

// GET /api/v1/generative/templates
router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  const templates = [
    { id: 'sigma', name: 'Sigma Rule', description: 'Detection rule for SIEM', color: ARTIFACT_TYPE_COLORS.sigma },
    { id: 'yara', name: 'YARA Rule', description: 'Malware detection rule', color: ARTIFACT_TYPE_COLORS.yara },
    { id: 'suricata', name: 'Suricata Rule', description: 'Network IDS rule', color: ARTIFACT_TYPE_COLORS.suricata },
    { id: 'kql', name: 'KQL Query', description: 'Azure Sentinel query', color: ARTIFACT_TYPE_COLORS.kql },
    { id: 'sql', name: 'SQL Query', description: 'Database query', color: ARTIFACT_TYPE_COLORS.sql },
    { id: 'playbook', name: 'Playbook', description: 'Incident response playbook', color: ARTIFACT_TYPE_COLORS.playbook },
    { id: 'powershell', name: 'PowerShell Script', description: 'Windows automation script', color: ARTIFACT_TYPE_COLORS.powershell },
    { id: 'bash', name: 'Bash Script', description: 'Linux automation script', color: ARTIFACT_TYPE_COLORS.bash },
    { id: 'python', name: 'Python Script', description: 'Cross-platform script', color: ARTIFACT_TYPE_COLORS.python },
    { id: 'runbook', name: 'Runbook', description: 'Operational procedure', color: ARTIFACT_TYPE_COLORS.runbook },
    { id: 'report', name: 'Report', description: 'Security report', color: ARTIFACT_TYPE_COLORS.report },
  ];

  res.json(withBrand({ templates }));
});

export function createGenerativeRoutes(): Router {
  return router;
}
