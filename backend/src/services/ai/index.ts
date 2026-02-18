/**
 * AI Module Index
 * 
 * Exports all AI-related functionality for T4.x implementation
 */

// Client exports
export {
  callAI,
  isRetryableError,
  createAIError,
  getAIConfig,
  prepareImagesForAI
} from './client';

// Orchestrator exports
export {
  runAIAnalysis,
  wouldExceedTimeout,
  withTimeout
} from './orchestrator';

// Prompt exports
export { buildOneStagePrompt } from './prompts/one-stage';
export { buildPerceptionPrompt, parsePerceptionResult } from './prompts/perception';
export { buildPlanningPrompt } from './prompts/planning';

// Re-export types for convenience
export type {
  AICallOptions,
  AIResponse,
  AIAnalysisResult,
  PerceptionResult,
  AIError,
  AIErrorCode,
  AIClientConfig
} from '../../types/ai';
