/**
 * Observability Module
 * 
 * Central export for all observability utilities:
 * - Structured logging (logger.ts)
 * - Prometheus metrics (metrics.ts)
 * - Request tracing (tracing.ts)
 */

// Re-export logger utilities
export {
  logRequest,
  logError,
  sanitizeLocation,
  getLogger
} from './logger';

// Re-export metrics utilities
export {
  incrementRequestCount,
  incrementEnrichmentResult,
  incrementAIInvalidOutput,
  incrementAIRepairSuccess,
  incrementErrorCode,
  recordLatency,
  recordPayloadSize,
  recordKeyframesExtracted,
  getMetrics,
  getRegistry,
  resetMetrics,
  metricsRegistry
} from './metrics';

// Re-export tracing utilities
export {
  startSpan,
  endSpan,
  getTraceForRequest,
  deleteTrace,
  getActiveTraceIds,
  getActiveTraceCount,
  startTraceCleanup,
  stopTraceCleanup,
  clearAllTraces,
  withSpan,
  withSpanSync
} from './tracing';

// Re-export types
export type {
  RequestLogData,
  SpanHandle,
  TraceInfo
} from '../../types/observability';

// Initialize on import
import { startTraceCleanup } from './tracing';

// Auto-start trace cleanup
startTraceCleanup();
