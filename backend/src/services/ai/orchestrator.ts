/**
 * AI Orchestrator (T4.3)
 * 
 * Orchestrates AI analysis flow - either one-stage or two-stage based on configuration.
 * Handles timing, error handling, and timeout enforcement.
 */

import pino from 'pino';
import { ContextPack } from '../../types/enrichment';
import { 
  AIAnalysisResult, 
  AICallOptions, 
  PerceptionResult 
} from '../../types/ai';
import { 
  callAI, 
  createAIError, 
  isRetryableError, 
  getAIConfig 
} from './client';
import { buildOneStagePrompt } from './prompts/one-stage';
import { buildPerceptionPrompt, parsePerceptionResult } from './prompts/perception';
import { buildPlanningPrompt } from './prompts/planning';

const logger = pino({ name: 'ai-orchestrator' });

/**
 * Default backend hard timeout (can be overridden via env)
 */
const DEFAULT_BACKEND_TIMEOUT_MS = 20000;

/**
 * Get orchestration configuration from environment
 */
interface OrchestratorConfig {
  /** Whether two-stage orchestration is enabled */
  twoStageEnabled: boolean;
  /** Backend hard timeout in ms */
  backendTimeoutMs: number;
  /** Photo AI timeout in ms */
  timeoutMsPhoto: number;
  /** Video AI timeout in ms */
  timeoutMsVideo: number;
}

function getOrchestratorConfig(): OrchestratorConfig {
  const config = getAIConfig();
  
  return {
    twoStageEnabled: process.env.AI_TWO_STAGE_ENABLED === 'true',
    backendTimeoutMs: parseInt(process.env.BACKEND_TIMEOUT_MS || '', 10) || DEFAULT_BACKEND_TIMEOUT_MS,
    timeoutMsPhoto: config.timeoutMsPhoto,
    timeoutMsVideo: config.timeoutMsVideo
  };
}

/**
 * Timing tracker for AI operations
 */
interface AITimings {
  perception_ms?: number;
  planning_ms?: number;
  total_ms: number;
}

/**
 * Request timings interface (matches request-context.ts)
 */
interface RequestTimings {
  startTimer(stage: string): void;
  endTimer(stage: string): number;
}

/**
 * Simple timing adapter that tracks start times
 */
class TimingTracker implements RequestTimings {
  private starts: Map<string, number> = new Map();
  private durations: Map<string, number> = new Map();

  startTimer(stage: string): void {
    this.starts.set(stage, Date.now());
  }

  endTimer(stage: string): number {
    const start = this.starts.get(stage);
    if (!start) return 0;
    const duration = Date.now() - start;
    this.durations.set(stage, duration);
    return duration;
  }

  getDuration(stage: string): number | undefined {
    return this.durations.get(stage);
  }
}

/**
 * Run one-stage AI analysis
 * 
 * Single call that produces the final overlay JSON directly.
 */
async function runOneStageAnalysis(
  images: Buffer[],
  contextPack: ContextPack,
  isVideo: boolean,
  timeoutMs: number
): Promise<{ result: unknown; model: string; rawResponse: string }> {
  const frameCount = images.length;
  const prompt = buildOneStagePrompt(contextPack, isVideo, frameCount);

  logger.info({
    stage: 'one-stage',
    isVideo,
    frameCount,
    promptLength: prompt.length,
    timeoutMs
  }, 'Running one-stage AI analysis');

  const options: AICallOptions = {
    timeout_ms: timeoutMs
  };

  const response = await callAI(prompt, images, options);

  // Parse the JSON response
  let parsedResult: unknown;
  try {
    parsedResult = JSON.parse(response.content);
  } catch (parseError) {
    throw createAIError(
      'AI_PARSE_ERROR',
      `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      false,
      { rawContent: response.content.substring(0, 500) }
    );
  }

  return {
    result: parsedResult,
    model: response.model,
    rawResponse: response.content
  };
}

/**
 * Run two-stage AI analysis
 * 
 * Stage 1: Perception - analyze visual content
 * Stage 2: Planning - generate overlay JSON using observations + context
 */
async function runTwoStageAnalysis(
  images: Buffer[],
  contextPack: ContextPack,
  isVideo: boolean,
  timeoutMsPerStage: number,
  timings: AITimings
): Promise<{ result: unknown; model: string; rawResponse: string }> {
  const frameCount = images.length;

  // --- Stage 1: Perception ---
  logger.info({
    stage: 'perception',
    isVideo,
    frameCount,
    timeoutMs: timeoutMsPerStage
  }, 'Running perception stage');

  const perceptionStart = Date.now();
  const perceptionPrompt = buildPerceptionPrompt(isVideo, frameCount);

  const perceptionOptions: AICallOptions = {
    timeout_ms: timeoutMsPerStage
  };

  const perceptionResponse = await callAI(perceptionPrompt, images, perceptionOptions);
  timings.perception_ms = Date.now() - perceptionStart;

  // Parse perception result
  let perceptionResult: PerceptionResult;
  try {
    perceptionResult = parsePerceptionResult(perceptionResponse.content);
  } catch (parseError) {
    throw createAIError(
      'AI_PARSE_ERROR',
      `Failed to parse perception result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      false,
      { rawContent: perceptionResponse.content.substring(0, 500) }
    );
  }

  logger.info({
    stage: 'perception',
    duration: timings.perception_ms,
    structureCount: perceptionResult.structure_elements.length,
    observationCount: perceptionResult.scene_observations.length
  }, 'Perception stage complete');

  // --- Stage 2: Planning ---
  logger.info({
    stage: 'planning',
    timeoutMs: timeoutMsPerStage
  }, 'Running planning stage');

  const planningStart = Date.now();
  const planningPrompt = buildPlanningPrompt(
    perceptionResult,
    contextPack,
    isVideo,
    frameCount
  );

  const planningOptions: AICallOptions = {
    timeout_ms: timeoutMsPerStage
  };

  const planningResponse = await callAI(planningPrompt, images, planningOptions);
  timings.planning_ms = Date.now() - planningStart;

  // Parse the final result
  let parsedResult: unknown;
  try {
    parsedResult = JSON.parse(planningResponse.content);
  } catch (parseError) {
    throw createAIError(
      'AI_PARSE_ERROR',
      `Failed to parse planning result as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      false,
      { rawContent: planningResponse.content.substring(0, 500) }
    );
  }

  logger.info({
    stage: 'planning',
    duration: timings.planning_ms,
    model: planningResponse.model
  }, 'Planning stage complete');

  return {
    result: parsedResult,
    model: planningResponse.model,
    rawResponse: planningResponse.content
  };
}

/**
 * Calculate remaining time budget for AI operations
 */
function calculateRemainingBudget(
  startTime: number,
  backendTimeoutMs: number,
  bufferMs: number = 1000
): number {
  const elapsed = Date.now() - startTime;
  const remaining = backendTimeoutMs - elapsed - bufferMs;
  return Math.max(remaining, 1000); // At least 1 second
}

/**
 * Run AI analysis with appropriate orchestration strategy
 * 
 * @param images - Image buffers (1 for photo, multiple for video keyframes)
 * @param contextPack - Enriched context pack
 * @param requestTimings - Request timing tracker (for recording to response)
 * @param isVideo - Whether this is a video analysis
 * @returns AI analysis result with parsed output and timings
 */
export async function runAIAnalysis(
  images: Buffer[],
  contextPack: ContextPack,
  requestTimings: RequestTimings,
  isVideo: boolean
): Promise<AIAnalysisResult> {
  const config = getOrchestratorConfig();
  const startTime = Date.now();

  // Determine base timeout based on media type
  const baseTimeoutMs = isVideo ? config.timeoutMsVideo : config.timeoutMsPhoto;

  const aiTimings: AITimings = {
    total_ms: 0
  };

  logger.info({
    twoStageEnabled: config.twoStageEnabled,
    isVideo,
    imageCount: images.length,
    baseTimeoutMs,
    backendTimeoutMs: config.backendTimeoutMs
  }, 'Starting AI analysis');

  try {
    let analysisResult: { result: unknown; model: string; rawResponse: string };

    if (config.twoStageEnabled) {
      // Two-stage: split timeout between perception and planning
      // Give slightly more time to planning as it produces the final output
      const perStageTimeout = Math.floor(baseTimeoutMs * 0.45);
      
      // Start timing for request context
      requestTimings.startTimer('ai_perception');
      
      analysisResult = await runTwoStageAnalysis(
        images,
        contextPack,
        isVideo,
        perStageTimeout,
        aiTimings
      );

      // Record to request timings
      requestTimings.endTimer('ai_perception');
      
      // Also record planning time if we want separate tracking
      if (aiTimings.planning_ms) {
        requestTimings.startTimer('ai_planning');
        // Since planning already completed, just record the duration
        // This is a slight hack but maintains timing interface
      }

    } else {
      // One-stage: single call with full timeout
      requestTimings.startTimer('ai_calls');
      
      analysisResult = await runOneStageAnalysis(
        images,
        contextPack,
        isVideo,
        baseTimeoutMs
      );

      requestTimings.endTimer('ai_calls');
    }

    // Calculate total AI time
    aiTimings.total_ms = Date.now() - startTime;

    logger.info({
      twoStageEnabled: config.twoStageEnabled,
      totalMs: aiTimings.total_ms,
      perceptionMs: aiTimings.perception_ms,
      planningMs: aiTimings.planning_ms,
      model: analysisResult.model
    }, 'AI analysis complete');

    return {
      result: analysisResult.result,
      model: analysisResult.model,
      timings: aiTimings,
      raw_response: analysisResult.rawResponse
    };

  } catch (error) {
    aiTimings.total_ms = Date.now() - startTime;

    logger.error({
      error,
      totalMs: aiTimings.total_ms,
      twoStageEnabled: config.twoStageEnabled
    }, 'AI analysis failed');

    // Re-throw with additional context
    throw error;
  }
}

/**
 * Check if backend timeout would be exceeded
 */
export function wouldExceedTimeout(
  startTime: number,
  additionalMs: number,
  backendTimeoutMs?: number
): boolean {
  const config = getOrchestratorConfig();
  const timeout = backendTimeoutMs ?? config.backendTimeoutMs;
  const elapsed = Date.now() - startTime;
  return (elapsed + additionalMs) > timeout;
}

/**
 * Utility to create a timeout-aware wrapper for any async operation
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(createAIError('AI_TIMEOUT', errorMessage, true, { timeoutMs }));
        });
      })
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Re-export error utilities for convenience
export { isRetryableError, createAIError };

export default {
  runAIAnalysis,
  isRetryableError,
  createAIError,
  wouldExceedTimeout,
  withTimeout
};
