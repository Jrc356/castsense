/**
 * CORS Configuration
 * 
 * Implements T6.2 requirements for CORS policy
 */

import { FastifyCorsOptions } from '@fastify/cors';

/**
 * Parse CORS allowed origins from environment variable
 * Returns array of allowed origins or false to deny all
 */
function parseAllowedOrigins(): string[] | false {
  const devMode = process.env.CORS_DEV_MODE === 'true';
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS;

  // Dev mode allows all origins
  if (devMode) {
    return [];  // Empty array signals "allow all" in our config
  }

  // No configured origins means deny all
  if (!originsEnv || originsEnv.trim() === '') {
    return false;
  }

  // Parse comma-separated list
  return originsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

/**
 * Origin validation function
 */
function validateOrigin(
  origin: string | undefined,
  allowedOrigins: string[] | false
): boolean {
  // No origin header (same-origin or non-browser request)
  if (!origin) {
    return true;
  }

  // Deny all if configured to do so
  if (allowedOrigins === false) {
    return false;
  }

  // Dev mode (empty array) allows all
  if (allowedOrigins.length === 0) {
    return true;
  }

  // Check if origin is in allowed list
  return allowedOrigins.includes(origin);
}

/**
 * Get CORS configuration for @fastify/cors plugin
 */
export function getCorsConfig(): FastifyCorsOptions {
  const allowedOrigins = parseAllowedOrigins();
  const devMode = process.env.CORS_DEV_MODE === 'true';
  
  console.log('🔐 CORS Debug Info:', {
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || '(not set)',
    CORS_DEV_MODE: process.env.CORS_DEV_MODE || '(not set)',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '(not set)',
    devMode,
    allowedOrigins,
  });

  return {
    // Origin handling
    origin: (origin, callback) => {
      const isAllowed = validateOrigin(origin, allowedOrigins);
      if (isAllowed) {
        // Allow the request
        callback(null, origin || true);
      } else {
        // Deny the request
        console.warn('🚫 CORS request blocked:', {
          origin: origin || '(no origin header)',
          allowedOrigins,
          allowedList: Array.isArray(allowedOrigins) ? allowedOrigins : 'deny-all',
        });
        callback(new Error('CORS origin not allowed'), false);
      }
    },

    // Allowed methods
    methods: ['GET', 'POST', 'OPTIONS'],

    // Allow credentials
    credentials: true,

    // Expose response headers to browser
    exposedHeaders: ['Retry-After', 'X-Request-ID'],

    // Max preflight cache time (24 hours in production, 1 hour in dev)
    maxAge: devMode ? 3600 : 86400,

    // Allow these headers in requests
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With'
    ],

    // Handle preflight errors
    strictPreflight: true,

    // Preflight response status code
    preflight: true,
    optionsSuccessStatus: 204
  };
}

/**
 * Log CORS configuration on startup
 */
export function logCorsConfig(logger: { info: (obj: object, msg: string) => void }): void {
  const devMode = process.env.CORS_DEV_MODE === 'true';
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS;

  if (devMode) {
    logger.info({ mode: 'dev', allowAll: true }, 'CORS configured in development mode (all origins allowed)');
  } else if (!originsEnv || originsEnv.trim() === '') {
    logger.info({ mode: 'production', allowedOrigins: 'none' }, 'CORS configured to deny all cross-origin requests');
  } else {
    const origins = originsEnv.split(',').map(o => o.trim()).filter(o => o.length > 0);
    logger.info({ mode: 'production', allowedOrigins: origins }, 'CORS configured with specific allowed origins');
  }
}
