// BLACKSENTINEL AI - Request Validation with Zod

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const TenantIdSchema = z.string().min(1).max(128);
export const UserIdSchema = z.string().min(1).max(128);
export const UUIDSchema = z.string().uuid();
export const EmailSchema = z.string().email();
export const TimestampSchema = z.string().datetime();

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

// tenantId/userId are optional here on purpose: both routes that use these
// schemas (query.ts, agents.ts) derive the real tenant/user from the
// authenticated JWT (req.tenantId/req.userId set by the `authenticate`
// middleware) and never trust a client-supplied value for either — see the
// tenant-isolation fix in the memory notes. Requiring them in the body too
// used to mean a correctly-implemented client that only sends a Bearer
// token (as it should) got a 500 from Zod validation before ever reaching
// that logic; caught by a real integration test hitting these routes
// end-to-end, which no mocked-pool unit test could have found.
export const QueryRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  tenantId: TenantIdSchema.optional(),
  userId: UserIdSchema.optional(),
  conversationId: UUIDSchema.optional(),
  context: z.record(z.unknown()).optional(),
});

export const AgentRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
  tenantId: TenantIdSchema.optional(),
  userId: UserIdSchema.optional(),
});

// ============================================================================
// KNOWLEDGE GRAPH SCHEMAS
// ============================================================================

export const KnowledgeSearchRequestSchema = z.object({
  query: z.string().min(1).max(5000),
  limit: z.number().int().min(1).max(1000).default(10),
  types: z.array(z.string()).optional(),
});

export const KnowledgeNodeSchema = z.object({
  type: z.string(),
  properties: z.record(z.unknown()),
});

export const KnowledgeEdgeSchema = z.object({
  source: UUIDSchema,
  target: UUIDSchema,
  type: z.string(),
  properties: z.record(z.unknown()).optional(),
});

// ============================================================================
// MEMORY SCHEMAS
// ============================================================================

export const MemoryTypeSchema = z.enum([
  'immediate', 'operational', 'historical', 'organizational',
  'contextual', 'investigation', 'incident', 'conversation',
]);

export const MemoryStoreRequestSchema = z.object({
  content: z.string().min(1).max(100000),
  type: MemoryTypeSchema,
  tenantId: TenantIdSchema,
  metadata: z.record(z.unknown()).optional(),
  expiresAt: TimestampSchema.optional(),
});

export const MemoryRetrieveRequestSchema = z.object({
  query: z.string().min(1).max(5000),
  tenantId: TenantIdSchema,
  limit: z.number().int().min(1).max(100).default(10),
  types: z.array(MemoryTypeSchema).optional(),
  minRelevance: z.number().min(0).max(1).default(0.5),
});

// ============================================================================
// GENERATIVE AI SCHEMAS
// ============================================================================

export const GenerationTypeSchema = z.enum([
  'sigma', 'yara', 'suricata', 'kql', 'sql', 'playbook',
  'powershell', 'bash', 'python', 'runbook', 'report',
]);

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'informational']);

export const GenerationRequestSchema = z.object({
  type: GenerationTypeSchema,
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  severity: SeveritySchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  mitreMapping: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
  tenantId: TenantIdSchema,
  userId: UserIdSchema,
});

// ============================================================================
// PREDICTIVE SCHEMAS
// ============================================================================

export const PredictionRequestSchema = z.object({
  tenantId: TenantIdSchema,
  timeframe: z.object({
    days: z.number().int().min(1).max(365),
  }).optional(),
  assets: z.array(z.string()).optional(),
  includeHistorical: z.boolean().default(true),
});

// ============================================================================
// MODEL SCHEMAS
// ============================================================================

export const ModelTypeSchema = z.enum(['llm', 'embedding', 'classification', 'detection', 'prediction']);

export const RegisterModelSchema = z.object({
  name: z.string().min(1).max(200),
  version: z.string().min(1),
  type: ModelTypeSchema,
  provider: z.string().min(1),
  endpoint: z.string().url(),
  capabilities: z.array(z.string()),
  tenantId: TenantIdSchema,
});

// ============================================================================
// XAI SCHEMAS
// ============================================================================

export const ExplanationRequestSchema = z.object({
  decisionId: UUIDSchema,
  detailLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed'),
  tenantId: TenantIdSchema,
});

// ============================================================================
// REPORT SCHEMAS
// ============================================================================

export const ReportRequestSchema = z.object({
  // Optional: reports.ts derives the real tenant from the authenticated
  // request (tenantOf(req)) the same way every other route does, and never
  // reads validated.tenantId. Requiring it here meant every report request
  // from the actual frontend (which never sent it) failed Zod validation
  // with a 500 — while the UI still showed "Report generated successfully",
  // because App.api() didn't check response.ok either. Both are fixed now.
  tenantId: TenantIdSchema.optional(),
  period: z.string().optional(),
  includeMetrics: z.boolean().default(true),
  format: z.enum(['markdown', 'json', 'pdf']).default('markdown'),
});

// ============================================================================
// USER / AUTH SCHEMAS
// ============================================================================

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(128),
});

export const CreateUserSchema = z.object({
  email: EmailSchema,
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
  company: z.string().max(255).optional(),
  role: z.enum(['ciso', 'security_director', 'soc_manager', 'soc_analyst', 'threat_hunter', 'incident_responder', 'viewer']),
  tenantId: TenantIdSchema,
});

// ============================================================================
// VALIDATION HELPER
// ============================================================================

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
