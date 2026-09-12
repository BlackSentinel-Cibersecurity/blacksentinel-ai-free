// BLACKSENTINEL AI - Custom Error Classes

export class BlackSentinelError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.name = 'BlackSentinelError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends BlackSentinelError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, true, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends BlackSentinelError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401, true);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends BlackSentinelError {
  constructor(message: string = 'Insufficient permissions', details?: unknown) {
    super(message, 'AUTHORIZATION_ERROR', 403, true, details);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends BlackSentinelError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      'NOT_FOUND',
      404,
      true
    );
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends BlackSentinelError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, true, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends BlackSentinelError {
  constructor(retryAfter: number = 60) {
    super(`Rate limit exceeded. Retry after ${retryAfter}s`, 'RATE_LIMIT_ERROR', 429, true, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class PromptInjectionError extends BlackSentinelError {
  constructor(details?: unknown) {
    super('Potential prompt injection detected', 'PROMPT_INJECTION', 400, true, details);
    this.name = 'PromptInjectionError';
  }
}

export class TenantIsolationError extends BlackSentinelError {
  constructor(message: string = 'Cross-tenant access denied') {
    super(message, 'TENANT_ISOLATION', 403, true);
    this.name = 'TenantIsolationError';
  }
}

export class ModelNotAvailableError extends BlackSentinelError {
  constructor(modelId: string) {
    super(`Model ${modelId} is not available`, 'MODEL_NOT_AVAILABLE', 503, true);
    this.name = 'ModelNotAvailableError';
  }
}

export class AgentNotAvailableError extends BlackSentinelError {
  constructor(agentType: string) {
    super(`Agent ${agentType} is not available`, 'AGENT_NOT_AVAILABLE', 503, true);
    this.name = 'AgentNotAvailableError';
  }
}

export class KnowledgeGraphError extends BlackSentinelError {
  constructor(message: string, details?: unknown) {
    super(message, 'KNOWLEDGE_GRAPH_ERROR', 500, true, details);
    this.name = 'KnowledgeGraphError';
  }
}

export class InferenceError extends BlackSentinelError {
  constructor(message: string, details?: unknown) {
    super(message, 'INFERENCE_ERROR', 500, true, details);
    this.name = 'InferenceError';
  }
}

export function isOperationalError(error: unknown): boolean {
  if (error instanceof BlackSentinelError) {
    return error.isOperational;
  }
  return false;
}
