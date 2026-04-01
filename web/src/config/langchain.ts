/**
 * LangChain Configuration Module
 *
 * Provides factory functions and configuration constants for initializing
 * LangChain chat models used for fishing analysis.
 *
 * Uses initChatModel (LangChain v1.1+ recommended pattern) for provider-agnostic
 * model initialization. Supports vision-capable models (gpt-4o, etc.) for
 * image analysis tasks.
 *
 * @example
 * import { createChatModel } from './config/langchain';
 *
 * const chatModel = await createChatModel(userApiKey, 'gpt-4o');
 * const response = await chatModel.invoke([
 *   { role: 'user', content: 'Analyze this fishing spot' }
 * ]);
 */

import { initChatModel } from 'langchain';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Temperature for AI model responses.
 * 
 * Controls randomness/creativity in responses. Higher values (e.g., 0.9) make
 * output more random, lower values (e.g., 0.2) make it more focused/deterministic.
 * 
 * Value: 0.7 (balanced between creativity and consistency)
 */
export const LANGCHAIN_TEMPERATURE = 0.7 as const;

/**
 * Request timeout in milliseconds.
 * 
 * Photo analysis timeout. Matches existing AI client behavior.
 * LangChain requests that exceed this duration will be aborted.
 * 
 * Value: 120000ms (120 seconds)
 */
export const LANGCHAIN_TIMEOUT_MS = 120000 as const;

/**
 * Maximum tokens for AI response.
 * 
 * Limits the length of generated responses to control costs and latency.
 * Fishing analysis responses typically fit within this limit.
 * 
 * Value: 4096 tokens (sufficient for detailed analysis with tactics)
 */
export const LANGCHAIN_MAX_TOKENS = 4096 as const;

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a configured chat model instance for fishing analysis.
 *
 * Uses LangChain's initChatModel (v1.1+ recommended pattern) for
 * provider-agnostic initialization. Currently targets OpenAI vision models
 * but can switch providers by changing modelName (e.g., 'anthropic:claude-3-5-sonnet').
 *
 * Standard configuration:
 * - Temperature: 0.7 (balanced creativity/consistency)
 * - Timeout: 30s (photo analysis)
 * - Max tokens: 4096 (sufficient for analysis responses)
 * - No retries (handled at application level)
 *
 * **Important:** The model must be vision-capable for image analysis.
 * Use models like 'gpt-4o' or 'gpt-4-turbo' for fishing spot analysis.
 *
 * @param apiKey - User's OpenAI API key (required for BYO-API-key model)
 * @param modelName - Model identifier (e.g., 'gpt-4o', 'gpt-4-vision-preview')
 * @returns Configured chat model ready for inference
 *
 * @example
 * const chatModel = await createChatModel(userApiKey, 'gpt-4o');
 *
 * // Use withStructuredOutput for typed results
 * const structured = chatModel.withStructuredOutput(MySchema);
 * const result = await structured.invoke([message]);
 *
 * @throws Error if API key is invalid (thrown by provider during first request)
 */
export async function createChatModel(apiKey: string, modelName: string) {
  return initChatModel(modelName, {
    apiKey,
    temperature: LANGCHAIN_TEMPERATURE,
    maxTokens: LANGCHAIN_MAX_TOKENS,
    timeout: LANGCHAIN_TIMEOUT_MS / 1000, // initChatModel expects seconds
    maxRetries: 0, // Retries handled at application level
  });
}
