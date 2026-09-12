// BLACKSENTINEL AI - Main Server Bootstrap
// Production-ready Express server with all middleware and routes

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from '@blacksentinel/shared/utils/config';
import { logger, createChildLogger } from '@blacksentinel/shared/utils/logger';
import { BlackSentinelError } from '@blacksentinel/shared/utils/errors';

// ============================================================================
// IMPORTS
// ============================================================================

import { createQueryRoutes } from './routes/query';
import { createAgentRoutes } from './routes/agents';
import { createKnowledgeRoutes } from './routes/knowledge';
import { createMemoryRoutes } from './routes/memory';
import { createGenerativeRoutes } from './routes/generative';
import { createPredictiveRoutes } from './routes/predictive';
import { createXAIRoutes } from './routes/xai';
import { createModelRoutes } from './routes/models';
import { createReportRoutes } from './routes/reports';
import { createHealthRoutes } from './routes/health';
import { createAuthRoutes } from './routes/auth';
import { createAlertRoutes } from './routes/alerts';
import { createInvestigationRoutes } from './routes/investigations';
import { createPlaybookRoutes } from './routes/playbooks';
import { createThreatIntelRoutes } from './routes/threat-intel';
import { createWebSocketHandler } from './websocket/handler';
import { initializeMetrics, metricsMiddleware, metricsEndpoint } from './middleware/metrics';
import { createRateLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import { authenticate } from './middleware/auth';
import { corsOptions } from './middleware/cors';
import { brandContext } from './middleware/brand';
import { BRAND } from '@blacksentinel/shared/constants/brand';
import { pool } from './db';
import { redis } from './redis';

// ============================================================================
// APP INITIALIZATION
// ============================================================================

const log = createChildLogger('server');
const app = express();
const httpServer = createServer(app);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// CORS
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', {
  stream: { write: (message: string) => log.info(message.trim()) },
}));

// Custom request logging
app.use(requestLogger);

// Metrics
app.use(metricsMiddleware);

// Rate limiting
app.use(createRateLimiter());

// Brand context - adds brand colors to all responses
app.use(brandContext);

// ============================================================================
// ROUTES
// ============================================================================

// Health and metrics (no auth required)
app.use('/health', createHealthRoutes());
app.use('/ready', createHealthRoutes());
app.use('/metrics', metricsEndpoint);

// Auth routes (no auth required)
app.use('/api/v1/auth', createAuthRoutes());

// Database-backed routes
// These previously had no auth "for local dev" — that comment is exactly the
// kind that ships to production unchanged. Alerts, investigations, playbooks
// and IOCs are core security data; they get the same `authenticate` every
// other data-bearing route already has.
app.use('/api/v1/alerts', authenticate, createAlertRoutes());
app.use('/api/v1/investigations', authenticate, createInvestigationRoutes());
app.use('/api/v1/playbooks', authenticate, createPlaybookRoutes());
app.use('/api/v1/threat-intel', authenticate, createThreatIntelRoutes());

// Protected routes
app.use('/api/v1/query', authenticate, createQueryRoutes());
app.use('/api/v1/agents', authenticate, createAgentRoutes());
app.use('/api/v1/knowledge', authenticate, createKnowledgeRoutes());
app.use('/api/v1/memory', authenticate, createMemoryRoutes());
app.use('/api/v1/generative', authenticate, createGenerativeRoutes());
app.use('/api/v1/predict', authenticate, createPredictiveRoutes());
app.use('/api/v1/xai', authenticate, createXAIRoutes());
app.use('/api/v1/models', authenticate, createModelRoutes());
app.use('/api/v1/reports', authenticate, createReportRoutes());

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
    },
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express only
// recognizes error-handling middleware by arity (4 params); `next` must stay
// even though this handler never calls it.
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof BlackSentinelError) {
    log.error({ error: err.toJSON(), requestId: (req as any).requestId }, 'Operational error');
    return res.status(err.statusCode).json({
      brand: {
        logo: BRAND.logo.primary,
        colors: BRAND.colors,
      },
      ...err.toJSON(),
    });
  }

  log.error({ error: err, requestId: (req as any).requestId }, 'Unexpected error');

  res.status(500).json({
    brand: {
      logo: BRAND.logo.primary,
      colors: BRAND.colors,
    },
    error: {
      code: 'INTERNAL_ERROR',
      message: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
});

// ============================================================================
// WEBSOCKET
// ============================================================================

if (config.WEBSOCKET_ENABLED) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  createWebSocketHandler(wss);
  log.info('WebSocket server initialized');
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const connections = new Set<any>();

httpServer.on('connection', (conn) => {
  connections.add(conn);
  conn.on('close', () => connections.delete(conn));
});

async function gracefulShutdown(signal: string) {
  log.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(() => {
    log.info('HTTP server closed');
  });

  // Close existing connections
  for (const conn of connections) {
    conn.destroy();
  }

  // Close DB/cache connections so nothing is left dangling under an
  // orchestrator (k8s etc. sends SIGTERM and expects a clean exit).
  try {
    await pool.end();
    log.info('Postgres pool closed');
  } catch (error) {
    log.error({ error }, 'Error closing Postgres pool');
  }

  try {
    await redis.quit();
    log.info('Redis connection closed');
  } catch (error) {
    log.error({ error }, 'Error closing Redis connection');
  }

  // Flush logs
  logger.flush();

  setTimeout(() => {
    log.info('Shutdown complete');
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  log.error({ reason }, 'Unhandled rejection');
});

process.on('uncaughtException', (error: Error) => {
  log.error({ error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  try {
    // Initialize metrics
    await initializeMetrics();

    // Start listening
    httpServer.listen(config.PORT, config.HOST, () => {
      log.info(`🚀 BlackSentinel AI Server running on ${config.HOST}:${config.PORT}`);
      log.info(`📊 Environment: ${config.NODE_ENV}`);
      log.info(`🔗 Health: http://localhost:${config.PORT}/health`);
      log.info(`📡 WebSocket: ws://localhost:${config.PORT}/ws`);
      log.info(`📈 Metrics: http://localhost:${config.PORT}/metrics`);
      log.info(`🔑 API: http://localhost:${config.PORT}/api/v1`);
    });
  } catch (error) {
    log.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();

export { app, httpServer };
