// BLACKSENTINEL AI - Core Type Definitions

// ============================================================================
// CORE ENUMS
// ============================================================================

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFORMATIONAL = 'informational',
}

export enum AgentType {
  SOC = 'soc',
  THREAT_HUNTER = 'threat_hunter',
  INCIDENT_RESPONSE = 'incident_response',
  THREAT_INTELLIGENCE = 'threat_intelligence',
  VULNERABILITY = 'vulnerability',
  IDENTITY = 'identity',
  ENDPOINT = 'endpoint',
  CLOUD = 'cloud',
  EXECUTIVE = 'executive',
  AUTOMATION = 'automation',
}

export enum DecisionType {
  PRIORITIZE_INCIDENT = 'prioritize_incident',
  ASSET_RISK = 'asset_risk',
  CLOSE_ALERT = 'close_alert',
  EXECUTE_AUTOMATION = 'execute_automation',
  INVESTIGATE_THREAT = 'investigate_threat',
  REVIEW_USER = 'review_user',
  REMEDIATE_VULNERABILITY = 'remediate_vulnerability',
  REQUIRE_HUMAN_APPROVAL = 'require_human_approval',
}

export enum ConfidenceLevel {
  VERY_LOW = 0.1,
  LOW = 0.3,
  MEDIUM = 0.5,
  HIGH = 0.7,
  VERY_HIGH = 0.9,
}

export enum MemoryType {
  IMMEDIATE = 'immediate',
  OPERATIONAL = 'operational',
  HISTORICAL = 'historical',
  ORGANIZATIONAL = 'organizational',
  CONTEXTUAL = 'contextual',
  INVESTIGATION = 'investigation',
  INCIDENT = 'incident',
  CONVERSATION = 'conversation',
}

export enum EntityType {
  USER = 'user',
  DEVICE = 'device',
  SERVER = 'server',
  CONTAINER = 'container',
  IDENTITY = 'identity',
  SECRET = 'secret',
  CERTIFICATE = 'certificate',
  VULNERABILITY = 'vulnerability',
  ALERT = 'alert',
  IOC = 'ioc',
  APT = 'apt',
  MITRE_TECHNIQUE = 'mitre_technique',
  CVE = 'cve',
  PROCESS = 'process',
  CONNECTION = 'connection',
  APPLICATION = 'application',
  AUTOMATION = 'automation',
  PLAYBOOK = 'playbook',
  SERVICE = 'service',
  CLOUD_RESOURCE = 'cloud_resource',
  SAAS = 'saas',
}

export enum RelationType {
  USES = 'uses',
  CONNECTS_TO = 'connects_to',
  DEPENDS_ON = 'depends_on',
  MANAGES = 'manages',
  ACCESSES = 'accesses',
  PROTECTS = 'protects',
  EXPLOITS = 'exploits',
  TARGETS = 'targets',
  REMEDIATES = 'remediates',
  TRIGGERS = 'triggers',
  CAUSED_BY = 'caused_by',
  AFFECTS = 'affects',
  CONTAINS = 'contains',
  PART_OF = 'part_of',
  COMMUNICATES_WITH = 'communicates_with',
  AUTHENTICATES = 'authenticates',
  OWNS = 'owns',
  INSTALLS = 'installs',
  EXECUTES = 'executes',
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface BaseEntity {
  id: string;
  type: EntityType;
  name: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string;
}

export interface EntityRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  source: string;
  timestamp: Date;
  relatedEntities: string[];
  mitreMapping?: string[];
  confidence: number;
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  tenantId: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: 'open' | 'investigating' | 'contained' | 'eradicated' | 'recovered' | 'closed';
  relatedAlerts: string[];
  relatedEntities: string[];
  timeline: IncidentEvent[];
  createdAt: Date;
  updatedAt: Date;
  tenantId: string;
}

export interface IncidentEvent {
  timestamp: Date;
  action: string;
  actor: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface Vulnerability {
  id: string;
  cveId: string;
  title: string;
  description: string;
  severity: Severity;
  cvssScore: number;
  affectedAssets: string[];
  exploitAvailable: boolean;
  patchAvailable: boolean;
  publishedAt: Date;
  tenantId: string;
}

export interface ThreatIntel {
  id: string;
  type: 'ioc' | 'apt' | 'campaign' | 'tool' | 'technique';
  name: string;
  description: string;
  confidence: number;
  severity: Severity;
  relatedEntities: string[];
  source: string;
  firstSeen: Date;
  lastSeen: Date;
  tenantId: string;
}

// ============================================================================
// AI ENGINE INTERFACES
// ============================================================================

export interface PerceptionEvent {
  id: string;
  source: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
  rawPayload: unknown;
  tenantId: string;
}

export interface KnowledgeNode {
  id: string;
  type: EntityType;
  properties: Record<string, unknown>;
  embedding?: number[];
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  properties: Record<string, unknown>;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  tenantId: string;
  createdAt: Date;
  expiresAt?: Date;
  accessCount: number;
  relevanceScore: number;
}

export interface ReasoningResult {
  conclusion: string;
  confidence: number;
  evidence: string[];
  reasoning: string[];
  alternatives: string[];
  limitations: string[];
  risks: string[];
}

export interface Decision {
  id: string;
  type: DecisionType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence: number;
  reasoning: ReasoningResult;
  requiresApproval: boolean;
  approvedBy?: string;
  executedAt?: Date;
  tenantId: string;
}

export interface AgentMessage {
  id: string;
  agentType: AgentType;
  content: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
  conversationId: string;
  parentId?: string;
}

export interface AgentTask {
  id: string;
  agentType: AgentType;
  description: string;
  input: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  createdAt: Date;
  completedAt?: Date;
  tenantId: string;
}

// ============================================================================
// API INTERFACES
// ============================================================================

export interface APIRequest {
  id: string;
  tenantId: string;
  userId: string;
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timestamp: Date;
}

export interface APIResponse {
  id: string;
  requestId: string;
  status: number;
  body?: unknown;
  error?: string;
  timestamp: Date;
}

export interface QueryRequest {
  query: string;
  context?: Record<string, unknown>;
  tenantId: string;
  userId: string;
  conversationId?: string;
}

export interface QueryResponse {
  answer: string;
  reasoning: ReasoningResult;
  sources: string[];
  suggestions: string[];
  visualizations?: Visualization[];
  actions?: RecommendedAction[];
}

export interface Visualization {
  type: 'graph' | 'timeline' | 'table' | 'chart' | 'diagram';
  title: string;
  data: unknown;
  config?: Record<string, unknown>;
}

export interface RecommendedAction {
  id: string;
  description: string;
  agentType: AgentType;
  confidence: number;
  requiresApproval: boolean;
  estimatedImpact: string;
}

// ============================================================================
// MODEL MANAGEMENT INTERFACES
// ============================================================================

export interface Model {
  id: string;
  name: string;
  version: string;
  type: 'llm' | 'embedding' | 'classification' | 'detection' | 'prediction';
  provider: string;
  endpoint: string;
  capabilities: string[];
  metrics: ModelMetrics;
  status: 'active' | 'inactive' | 'deprecated' | 'testing';
  tenantId: string;
}

export interface ModelMetrics {
  accuracy: number;
  latency: number;
  costPerToken: number;
  totalTokensUsed: number;
  totalRequests: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface ModelVersion {
  id: string;
  modelId: string;
  version: string;
  artifactUrl: string;
  metrics: ModelMetrics;
  deployedAt: Date;
  status: 'active' | 'inactive' | 'rollback';
}

// ============================================================================
// OBSERVABILITY INTERFACES
// ============================================================================

export interface InferenceLog {
  id: string;
  modelId: string;
  input: unknown;
  output: unknown;
  latency: number;
  tokensUsed: number;
  cost: number;
  userId: string;
  tenantId: string;
  timestamp: Date;
}

export interface MetricPoint {
  timestamp: Date;
  value: number;
  labels: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: Severity;
  enabled: boolean;
  tenantId: string;
}

// ============================================================================
// SECURITY INTERFACES
// ============================================================================

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  enabled: boolean;
  tenantId: string;
}

export interface PolicyRule {
  id: string;
  action: 'allow' | 'deny' | 'require_approval';
  resource: string;
  conditions: Record<string, unknown>;
  priority: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  resource: string;
  details: Record<string, unknown>;
  timestamp: Date;
  tenantId: string;
  immutable: boolean;
}

export interface AccessControl {
  userId: string;
  roles: string[];
  permissions: string[];
  abacPolicies: Record<string, unknown>[];
}
