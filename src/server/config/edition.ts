// ============================================================================
// BlackSentinel AI — Free / Open-Source Edition
//
// Only 'soc', 'threat_hunter', and 'incident_response' have real analysis
// logic (see routes/agents.ts's own header comment — every other agent type
// already refuses with 501 rather than fake it). Free plan: 50 agent
// queries per 30 days against those three, counted via the actual
// persisted conversation_messages rows (persistExchange in
// services/socAgent.ts), not an invented number.
// ============================================================================

export const FREE_LIMITS = {
  maxQueriesPerMonth: 50,
} as const;

export const editionConfig = {
  edition: 'free' as const,
  limits: FREE_LIMITS,
};
