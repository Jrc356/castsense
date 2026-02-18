/**
 * Request Context Utility
 * 
 * Provides request ID generation and timing tracking per §7.4
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Valid timing stages for the request lifecycle
 */
export type TimingStage = 
  | 'upload_parse'
  | 'enrichment'
  | 'keyframes'
  | 'ai_calls'
  | 'ai_perception'
  | 'ai_planning'
  | 'validation'
  | 'total';

/**
 * Timing record with start time and optional end time
 */
interface TimingRecord {
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * Request context for tracking request metadata and timings
 */
export interface RequestContext {
  requestId: string;
  createdAt: number;
  timings: Map<TimingStage, TimingRecord>;
}

/**
 * Creates a new request context with unique ID and timing tracker
 */
export function createRequestContext(): RequestContext {
  const context: RequestContext = {
    requestId: uuidv4(),
    createdAt: Date.now(),
    timings: new Map()
  };

  // Auto-start total timing
  startTimer(context, 'total');

  return context;
}

/**
 * Starts a timer for a specific stage
 */
export function startTimer(context: RequestContext, stage: TimingStage): void {
  context.timings.set(stage, {
    startTime: Date.now()
  });
}

/**
 * Ends a timer for a specific stage and calculates duration
 */
export function endTimer(context: RequestContext, stage: TimingStage): number {
  const record = context.timings.get(stage);
  
  if (!record) {
    // Stage wasn't started, create a zero-duration record
    context.timings.set(stage, {
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0
    });
    return 0;
  }

  const endTime = Date.now();
  const duration = endTime - record.startTime;
  
  context.timings.set(stage, {
    ...record,
    endTime,
    duration
  });

  return duration;
}

/**
 * Gets all recorded timings in milliseconds
 * Returns only completed timings (those with durations)
 */
export function getTimings(context: RequestContext): Record<string, number> {
  const timings: Record<string, number> = {};

  for (const [stage, record] of context.timings) {
    if (record.duration !== undefined) {
      // Map internal stage names to response format
      const key = mapStageToResponseKey(stage);
      timings[key] = record.duration;
    }
  }

  return timings;
}

/**
 * Maps internal stage names to response envelope keys per §7.4
 */
function mapStageToResponseKey(stage: TimingStage): string {
  const mapping: Record<TimingStage, string> = {
    'upload_parse': 'upload',
    'enrichment': 'enrichment',
    'keyframes': 'keyframes',
    'ai_calls': 'ai_perception', // One-stage AI timing maps to perception
    'ai_perception': 'ai_perception',
    'ai_planning': 'ai_planning',
    'validation': 'validation',
    'total': 'total'
  };
  return mapping[stage] || stage;
}

/**
 * Finalizes all timings and returns the complete timing object
 * Call this at the end of request processing
 */
export function finalizeTimings(context: RequestContext): Record<string, number> {
  // End total timer if not already ended
  const totalRecord = context.timings.get('total');
  if (totalRecord && totalRecord.duration === undefined) {
    endTimer(context, 'total');
  }

  return getTimings(context);
}

/**
 * Helper to execute a function while tracking its timing
 */
export async function withTiming<T>(
  context: RequestContext,
  stage: TimingStage,
  fn: () => Promise<T>
): Promise<T> {
  startTimer(context, stage);
  try {
    return await fn();
  } finally {
    endTimer(context, stage);
  }
}
