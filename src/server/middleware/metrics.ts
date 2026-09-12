// BLACKSENTINEL AI - Metrics Middleware

import { Request, Response, NextFunction } from 'express';

let requestCount = 0;
let errorCount = 0;
const latencies: number[] = [];

export function initializeMetrics() {
  requestCount = 0;
  errorCount = 0;
  latencies.length = 0;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const latency = Date.now() - startTime;
    requestCount++;
    latencies.push(latency);

    if (res.statusCode >= 400) {
      errorCount++;
    }

    if (latencies.length > 1000) {
      latencies.splice(0, latencies.length - 1000);
    }
  });

  next();
}

export function metricsEndpoint(req: Request, res: Response) {
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
  const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
  const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
  const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  const metrics = `# HELP blacksentinel_requests_total Total number of requests
# TYPE blacksentinel_requests_total counter
blacksentinel_requests_total ${requestCount}

# HELP blacksentinel_errors_total Total number of errors
# TYPE blacksentinel_errors_total counter
blacksentinel_errors_total ${errorCount}

# HELP blacksentinel_request_duration_seconds Request latency
# TYPE blacksentinel_request_duration_seconds summary
blacksentinel_request_duration_seconds{quantile="0.5"} ${p50 / 1000}
blacksentinel_request_duration_seconds{quantile="0.95"} ${p95 / 1000}
blacksentinel_request_duration_seconds{quantile="0.99"} ${p99 / 1000}
blacksentinel_request_duration_seconds{quantile="avg"} ${avg / 1000}

# HELP blacksentinel_memory_usage_bytes Memory usage
# TYPE blacksentinel_memory_usage_bytes gauge
blacksentinel_memory_usage_bytes ${process.memoryUsage().heapUsed}

# HELP blacksentinel_uptime_seconds Uptime
# TYPE blacksentinel_uptime_seconds gauge
blacksentinel_uptime_seconds ${process.uptime()}
`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(metrics);
}
