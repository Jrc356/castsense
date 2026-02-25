import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config as loadEnv } from 'dotenv';

// Import configuration system
import { loadConfig, getConfig } from './config';

// Import routes
import healthRoutes from './routes/health';
import analyzeRoutes from './routes/analyze';

// Import middleware
import { rateLimiterMiddleware, startRateLimitCleanup } from './middleware/rate-limiter';
import { getCorsConfig, logCorsConfig } from './middleware/cors';
import { inputHardeningMiddleware, startInputHardeningCleanup } from './middleware/input-hardening';

// Load environment variables from .env file
loadEnv();

// Load and validate configuration - fails fast if invalid
const appConfig = loadConfig();

const server = Fastify({
  logger: {
    level: appConfig.logLevel,
    transport: appConfig.nodeEnv !== 'production' 
      ? { target: 'pino-pretty' }
      : undefined
  }
});

async function start() {
  const config = getConfig();

  try {
    // Log startup configuration (excluding sensitive values)
    server.log.info({
      nodeEnv: config.nodeEnv,
      port: config.port,
      host: config.host,
      buildVersion: config.buildVersion,
      aiModel: config.aiModel,
      aiTwoStageEnabled: config.aiTwoStageEnabled,
      maxPhotoBytes: config.maxPhotoBytes,
      maxVideoBytes: config.maxVideoBytes,
    }, 'CastSense backend starting with configuration');

    // 1. Register CORS (T6.2) - must be first to handle preflight requests
    await server.register(cors, getCorsConfig());
    logCorsConfig(server.log);

    // 2. Register multipart for file uploads (before rate limiting to allow OPTIONS)
    await server.register(multipart, {
      limits: {
        fileSize: Math.max(config.maxPhotoBytes, config.maxVideoBytes)
      }
    });

    // 3. Register rate limiting middleware (T6.1)
    // This is custom per-API-key rate limiting with RPM + concurrency
    server.addHook('preHandler', rateLimiterMiddleware);
    startRateLimitCleanup();
    server.log.info({
      rpm: config.rateLimitRpm,
      concurrency: config.rateLimitConcurrency
    }, 'Rate limiting configured');

    // 4. Input hardening middleware (T6.3) - only for analyze route
    // We register it as a route-specific hook below when registering analyze routes
    startInputHardeningCleanup();

    // Register routes
    await server.register(healthRoutes);
    
    // Register analyze routes with input hardening middleware
    await server.register(async (instance) => {
      // Add input hardening hook for this sub-context (analyze routes only)
      instance.addHook('preHandler', inputHardeningMiddleware);
      await instance.register(analyzeRoutes);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      server.log.info({ signal }, 'Received shutdown signal');
      await server.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Start server
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`CastSense backend listening on ${config.host}:${config.port}`);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
