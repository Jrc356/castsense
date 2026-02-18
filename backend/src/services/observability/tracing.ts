/**
 * Request Tracing
 * 
 * Simple in-memory trace span tracking for v1
 * Correlates spans with request_id for debugging and performance analysis
 * 
 * Tracked stages:
 * - upload_parse
 * - enrichment (with sub-spans for each provider)
 * - keyframe_extraction
 * - ai_perception
 * - ai_planning
 * - validation
 * - repair
 */

import { SpanHandle, SpanRecord, TraceInfo } from '../../types/observability';

/**
 * In-memory trace storage
 * Maps request_id -> array of span records
 */
const traces = new Map<string, SpanRecord[]>();

/**
 * Maximum number of traces to keep in memory
 * Prevents unbounded memory growth
 */
const MAX_TRACES = parseInt(process.env.MAX_TRACES || '1000', 10);

/**
 * Trace TTL in milliseconds (default: 5 minutes)
 * After this time, traces are eligible for cleanup
 */
const TRACE_TTL_MS = parseInt(process.env.TRACE_TTL_MS || '300000', 10);

/**
 * Timestamp tracking for trace cleanup
 */
const traceTimestamps = new Map<string, number>();

/**
 * Start a new span for a processing stage
 * 
 * @param requestId - The request ID to associate with the span
 * @param name - The span name (e.g., 'enrichment', 'ai_perception')
 * @returns SpanHandle to be passed to endSpan()
 */
export function startSpan(requestId: string, name: string): SpanHandle {
  const startTime = Date.now();
  
  // Initialize trace array if needed
  if (!traces.has(requestId)) {
    traces.set(requestId, []);
    traceTimestamps.set(requestId, startTime);
    
    // Cleanup old traces if we're at capacity
    if (traces.size > MAX_TRACES) {
      cleanupOldTraces();
    }
  }
  
  // Add the span record (incomplete until endSpan is called)
  const spans = traces.get(requestId)!;
  spans.push({
    name,
    startTime
  });
  
  return {
    requestId,
    name,
    startTime
  };
}

/**
 * End a span and record its duration
 * 
 * @param handle - The SpanHandle returned by startSpan()
 */
export function endSpan(handle: SpanHandle): void {
  const endTime = Date.now();
  const spans = traces.get(handle.requestId);
  
  if (!spans) {
    // Trace was cleaned up or never started
    return;
  }
  
  // Find the matching span (latest one with same name that isn't completed)
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i];
    if (span && span.name === handle.name && span.startTime === handle.startTime && span.endTime === undefined) {
      span.endTime = endTime;
      span.durationMs = endTime - span.startTime;
      break;
    }
  }
}

/**
 * Get the complete trace for a request
 * 
 * @param requestId - The request ID
 * @returns TraceInfo with all spans, or empty trace if not found
 */
export function getTraceForRequest(requestId: string): TraceInfo {
  const spans = traces.get(requestId);
  
  if (!spans || spans.length === 0) {
    return {
      requestId,
      spans: []
    };
  }
  
  // Get the trace start time (earliest span)
  const traceStartTime = Math.min(...spans.map(s => s.startTime));
  
  // Convert to TraceInfo format
  return {
    requestId,
    spans: spans.map(span => ({
      name: span.name,
      startMs: span.startTime - traceStartTime, // Relative to trace start
      durationMs: span.durationMs ?? 0
    }))
  };
}

/**
 * Delete trace for a request (cleanup after request completion)
 * 
 * @param requestId - The request ID to remove
 */
export function deleteTrace(requestId: string): void {
  traces.delete(requestId);
  traceTimestamps.delete(requestId);
}

/**
 * Get all active trace request IDs (for debugging)
 */
export function getActiveTraceIds(): string[] {
  return Array.from(traces.keys());
}

/**
 * Get count of active traces
 */
export function getActiveTraceCount(): number {
  return traces.size;
}

/**
 * Cleanup traces older than TRACE_TTL_MS
 */
function cleanupOldTraces(): void {
  const now = Date.now();
  const cutoffTime = now - TRACE_TTL_MS;
  
  for (const [requestId, timestamp] of traceTimestamps) {
    if (timestamp < cutoffTime) {
      traces.delete(requestId);
      traceTimestamps.delete(requestId);
    }
  }
}

/**
 * Start periodic cleanup of old traces
 * Returns cleanup interval handle
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startTraceCleanup(): void {
  if (cleanupInterval) {
    return; // Already running
  }
  
  // Run cleanup every minute
  cleanupInterval = setInterval(() => {
    cleanupOldTraces();
  }, 60000);
  
  // Don't keep process alive just for cleanup
  cleanupInterval.unref();
}

/**
 * Stop the cleanup interval
 */
export function stopTraceCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear all traces (for testing)
 */
export function clearAllTraces(): void {
  traces.clear();
  traceTimestamps.clear();
}

/**
 * Helper: Execute an async function within a span
 * Automatically starts and ends the span
 * 
 * @param requestId - The request ID
 * @param name - The span name
 * @param fn - The async function to execute
 * @returns The result of the function
 */
export async function withSpan<T>(
  requestId: string,
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const handle = startSpan(requestId, name);
  try {
    return await fn();
  } finally {
    endSpan(handle);
  }
}

/**
 * Helper: Execute a sync function within a span
 * 
 * @param requestId - The request ID
 * @param name - The span name
 * @param fn - The sync function to execute
 * @returns The result of the function
 */
export function withSpanSync<T>(
  requestId: string,
  name: string,
  fn: () => T
): T {
  const handle = startSpan(requestId, name);
  try {
    return fn();
  } finally {
    endSpan(handle);
  }
}

export default {
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
};
