// BLACKSENTINEL AI - Configuration System

import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ============================================================================
// CONFIGURATION SCHEMA
// ============================================================================

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),

  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  NEO4J_URL: z.string().default('bolt://localhost:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('password'),
  VECTOR_DB_URL: z.string().url().default('http://localhost:8000'),
  POSTGRES_URL: z.string().url().default('postgresql://localhost:5432/blacksentinel'),

  AI_ENGINE_HOST: z.string().default('localhost'),
  AI_ENGINE_PORT: z.coerce.number().default(8080),
  AGENT_ORCHESTRATOR_HOST: z.string().default('localhost'),
  AGENT_ORCHESTRATOR_PORT: z.coerce.number().default(8081),
  KNOWLEDGE_GRAPH_HOST: z.string().default('localhost'),
  KNOWLEDGE_GRAPH_PORT: z.coerce.number().default(8082),
  MEMORY_SERVICE_HOST: z.string().default('localhost'),
  MEMORY_SERVICE_PORT: z.coerce.number().default(8083),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  TRUST_PROXY: z.coerce.number().default(1),

  LLM_PROVIDER: z.string().default('openai'),
  LLM_MODEL: z.string().default('gpt-4'),
  LLM_API_KEY: z.string().optional(),
  LLM_MAX_TOKENS: z.coerce.number().default(4096),
  LLM_TEMPERATURE: z.coerce.number().default(0.1),

  METRICS_ENABLED: z.coerce.boolean().default(true),
  TRACING_ENABLED: z.coerce.boolean().default(true),
  WEBSOCKET_ENABLED: z.coerce.boolean().default(true),
});

// ============================================================================
// PARSE AND EXPORT
// ============================================================================

type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
export type { Config };
export default config;
