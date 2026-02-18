/**
 * Health Check Route
 * 
 * GET /v1/health - Returns service health status
 * GET /metrics - Prometheus metrics endpoint
 * Implements T1.1, T7.2 requirements
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getMetrics } from '../services/observability';

/**
 * Health check response structure
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime_seconds?: number;
}

// Track server start time for uptime calculation
const startTime = Date.now();

// Load package version at module load time
let packageVersion = '0.1.0';
try {
  const packagePath = join(__dirname, '../../package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
  packageVersion = packageJson.version || packageVersion;
} catch {
  // Fallback to default version if package.json can't be read
}

/**
 * Register health check routes
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  
  fastify.get('/v1/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const response: HealthResponse = {
      status: 'ok',
      version: process.env.BUILD_VERSION || packageVersion,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
    };
    
    return response;
  });

  /**
   * GET /metrics - Prometheus metrics endpoint
   * Returns metrics in Prometheus text exposition format
   */
  fastify.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await getMetrics();
    reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return metrics;
  });
}

export default healthRoutes;
