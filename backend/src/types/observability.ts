/**
 * Observability Types
 * 
 * Type definitions for logging, metrics, and tracing
 */

/**
 * Structured log data for request logging per §11.2
 */
export interface RequestLogData {
  request_id: string;
  status: "ok" | "degraded" | "error";
  timings_ms: Record<string, number>;
  client?: {
    platform?: string;
    app_version?: string;
  };
  mode?: string;
  capture_type?: string;
  enrichment_status?: Record<string, string>;
  ai_model?: string;
  ai_response_size?: number;
  validation_errors?: string[];
  location?: { lat: number; lon: number } | null;
  error_code?: string;
}

/**
 * Handle returned when starting a tracing span
 */
export interface SpanHandle {
  requestId: string;
  name: string;
  startTime: number;
}

/**
 * Complete trace information for a request
 */
export interface TraceInfo {
  requestId: string;
  spans: Array<{
    name: string;
    startMs: number;
    durationMs: number;
  }>;
}

/**
 * Internal span storage structure
 */
export interface SpanRecord {
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

/**
 * Metrics labels for type safety
 */
export interface MetricLabels {
  status?: string;
  provider?: string;
  stage?: string;
  type?: string;
  code?: string;
  success?: string;
}
