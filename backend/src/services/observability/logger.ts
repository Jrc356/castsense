/**
 * Structured Request Logger
 * 
 * Provides structured JSON logging for requests per §11.2
 * - Sanitizes sensitive data (location gated, no raw media)
 * - Logs request lifecycle with timing information
 */

import pino from 'pino';
import { RequestLogData } from '../../types/observability';

// Create dedicated logger instance for observability
const logger = pino({
  name: 'castsense-observability',
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty' }
  })
});

/**
 * Check if location logging is enabled via environment variable
 * Default: false (location not logged)
 */
function isLocationLoggingEnabled(): boolean {
  const enabled = process.env.LOG_LOCATION_ENABLED;
  return enabled === 'true' || enabled === '1';
}

/**
 * Sanitize location data by rounding to 2 decimal places
 * Returns null if location logging is disabled
 * 
 * @param lat - Latitude value
 * @param lon - Longitude value
 * @returns Coarsened location or null if disabled
 */
export function sanitizeLocation(
  lat: number, 
  lon: number
): { lat: number; lon: number } | null {
  if (!isLocationLoggingEnabled()) {
    return null;
  }

  // Round to 2 decimal places (~1.1km precision)
  return {
    lat: Math.round(lat * 100) / 100,
    lon: Math.round(lon * 100) / 100
  };
}

/**
 * Log a complete request with all relevant fields per §11.2
 * 
 * Fields logged:
 * - request_id
 * - timings (total, per stage)
 * - app version/platform from client metadata
 * - mode/capture_type
 * - enrichment statuses
 * - AI model identifier + response size (no raw media)
 * - validation failure types (not raw content)
 * - location (if LOG_LOCATION_ENABLED=true, coarsened)
 * 
 * @param data - Request log data
 */
export function logRequest(data: RequestLogData): void {
  // Build sanitized log entry
  const logEntry: Record<string, unknown> = {
    request_id: data.request_id,
    status: data.status,
    timings_ms: data.timings_ms
  };

  // Add client info if present
  if (data.client) {
    logEntry.client = {
      platform: data.client.platform,
      app_version: data.client.app_version
    };
  }

  // Add request mode info
  if (data.mode) {
    logEntry.mode = data.mode;
  }
  if (data.capture_type) {
    logEntry.capture_type = data.capture_type;
  }

  // Add enrichment status
  if (data.enrichment_status) {
    logEntry.enrichment_status = data.enrichment_status;
  }

  // Add AI info (model + response size only, no raw content)
  if (data.ai_model) {
    logEntry.ai_model = data.ai_model;
  }
  if (data.ai_response_size !== undefined) {
    logEntry.ai_response_size = data.ai_response_size;
  }

  // Add validation error types (not raw content)
  if (data.validation_errors && data.validation_errors.length > 0) {
    logEntry.validation_errors = data.validation_errors;
  }

  // Add sanitized location if enabled
  if (data.location) {
    const sanitized = sanitizeLocation(data.location.lat, data.location.lon);
    if (sanitized) {
      logEntry.location = sanitized;
    }
  }

  // Add error code if present
  if (data.error_code) {
    logEntry.error_code = data.error_code;
  }

  // Log at appropriate level based on status
  switch (data.status) {
    case 'ok':
      logger.info(logEntry, 'Request completed successfully');
      break;
    case 'degraded':
      logger.warn(logEntry, 'Request completed with degraded status');
      break;
    case 'error':
      logger.error(logEntry, 'Request failed');
      break;
    default:
      logger.info(logEntry, 'Request completed');
  }
}

/**
 * Log an error that occurred during request processing
 * 
 * @param requestId - The request ID
 * @param error - The error that occurred
 * @param context - Additional context about where the error occurred
 */
export function logError(
  requestId: string, 
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorInfo: Record<string, unknown> = {
    request_id: requestId
  };

  // Extract error details safely
  if (error instanceof Error) {
    errorInfo.error_name = error.name;
    errorInfo.error_message = error.message;
    // Include stack trace in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      errorInfo.error_stack = error.stack;
    }
  } else if (typeof error === 'string') {
    errorInfo.error_message = error;
  } else {
    errorInfo.error_message = 'Unknown error';
    errorInfo.error_type = typeof error;
  }

  // Add additional context if provided
  if (context) {
    errorInfo.context = context;
  }

  logger.error(errorInfo, 'Error during request processing');
}

/**
 * Get the underlying pino logger for advanced use cases
 */
export function getLogger(): pino.Logger {
  return logger;
}

export default {
  logRequest,
  logError,
  sanitizeLocation,
  getLogger
};
