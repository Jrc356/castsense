/**
 * Prometheus Metrics Instrumentation
 * 
 * Implements metrics per §11.1:
 * - Counters: request_count, enrichment results, AI invalid/repair, error codes
 * - Histograms: latency, payload size, keyframes
 */

import { Registry, Counter, Histogram } from 'prom-client';

// Create a custom registry for CastSense metrics
export const metricsRegistry = new Registry();

// Set default labels
metricsRegistry.setDefaultLabels({
  app: 'castsense',
  service: 'backend'
});

// ============================================================================
// COUNTERS
// ============================================================================

/**
 * Request count by status (ok|degraded|error)
 */
const requestCountCounter = new Counter({
  name: 'castsense_request_count_total',
  help: 'Total number of requests by status',
  labelNames: ['status'] as const,
  registers: [metricsRegistry]
});

/**
 * Enrichment results by provider and success/failure
 */
const enrichmentResultCounter = new Counter({
  name: 'castsense_enrichment_result_total',
  help: 'Enrichment results by provider and outcome',
  labelNames: ['provider', 'success'] as const,
  registers: [metricsRegistry]
});

/**
 * AI invalid output count (validation failures)
 */
const aiInvalidOutputCounter = new Counter({
  name: 'castsense_ai_invalid_output_total',
  help: 'Count of AI responses that failed validation',
  registers: [metricsRegistry]
});

/**
 * AI repair success count
 */
const aiRepairSuccessCounter = new Counter({
  name: 'castsense_ai_repair_success_total',
  help: 'Count of successful AI output repairs',
  registers: [metricsRegistry]
});

/**
 * Error codes distribution
 */
const errorCodeCounter = new Counter({
  name: 'castsense_error_code_total',
  help: 'Distribution of error codes',
  labelNames: ['code'] as const,
  registers: [metricsRegistry]
});

// ============================================================================
// HISTOGRAMS
// ============================================================================

// Define latency buckets in milliseconds
// Covers range from 10ms to 60s
const LATENCY_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];

/**
 * Total request latency in milliseconds
 */
const totalLatencyHistogram = new Histogram({
  name: 'castsense_total_latency_ms',
  help: 'Total request latency in milliseconds',
  buckets: LATENCY_BUCKETS,
  registers: [metricsRegistry]
});

/**
 * Per-stage latency in milliseconds
 */
const stageLatencyHistogram = new Histogram({
  name: 'castsense_stage_latency_ms',
  help: 'Processing stage latency in milliseconds',
  labelNames: ['stage'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [metricsRegistry]
});

// Define payload size buckets in bytes
// Covers range from 1KB to 50MB
const SIZE_BUCKETS = [
  1024,         // 1KB
  10240,        // 10KB
  102400,       // 100KB
  524288,       // 512KB
  1048576,      // 1MB
  2097152,      // 2MB
  5242880,      // 5MB
  10485760,     // 10MB
  26214400,     // 25MB
  52428800      // 50MB
];

/**
 * Payload size in bytes (photo/video)
 */
const payloadSizeHistogram = new Histogram({
  name: 'castsense_payload_size_bytes',
  help: 'Payload size in bytes by type',
  labelNames: ['type'] as const,
  buckets: SIZE_BUCKETS,
  registers: [metricsRegistry]
});

// Define keyframe count buckets
const KEYFRAME_BUCKETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20];

/**
 * Keyframes extracted from video
 */
const keyframesExtractedHistogram = new Histogram({
  name: 'castsense_keyframes_extracted_count',
  help: 'Number of keyframes extracted from video',
  buckets: KEYFRAME_BUCKETS,
  registers: [metricsRegistry]
});

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Increment request count by status
 * @param status - Request status (ok|degraded|error)
 */
export function incrementRequestCount(status: string): void {
  requestCountCounter.inc({ status });
}

/**
 * Record enrichment result for a provider
 * @param provider - Enrichment provider name (weather|solar|geocode)
 * @param success - Whether the enrichment succeeded
 */
export function incrementEnrichmentResult(provider: string, success: boolean): void {
  enrichmentResultCounter.inc({ 
    provider, 
    success: success ? 'true' : 'false' 
  });
}

/**
 * Increment AI invalid output counter
 */
export function incrementAIInvalidOutput(): void {
  aiInvalidOutputCounter.inc();
}

/**
 * Increment AI repair success counter
 */
export function incrementAIRepairSuccess(): void {
  aiRepairSuccessCounter.inc();
}

/**
 * Increment error code counter
 * @param code - Error code (e.g., NO_GPS, RATE_LIMITED, etc.)
 */
export function incrementErrorCode(code: string): void {
  errorCodeCounter.inc({ code });
}

/**
 * Record latency for a processing stage
 * @param stage - Stage name (enrichment|ai_perception|ai_planning|validation|total)
 * @param durationMs - Duration in milliseconds
 */
export function recordLatency(stage: string, durationMs: number): void {
  if (stage === 'total') {
    totalLatencyHistogram.observe(durationMs);
  }
  stageLatencyHistogram.observe({ stage }, durationMs);
}

/**
 * Record payload size
 * @param type - Payload type (photo|video)
 * @param bytes - Size in bytes
 */
export function recordPayloadSize(type: string, bytes: number): void {
  payloadSizeHistogram.observe({ type }, bytes);
}

/**
 * Record number of keyframes extracted
 * @param count - Number of keyframes
 */
export function recordKeyframesExtracted(count: number): void {
  keyframesExtractedHistogram.observe(count);
}

/**
 * Get all metrics in Prometheus text format
 * @returns Promise resolving to Prometheus-formatted metrics string
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Get the metrics registry for direct access
 */
export function getRegistry(): Registry {
  return metricsRegistry;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}

export default {
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
  resetMetrics
};
