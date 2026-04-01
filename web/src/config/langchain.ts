/**
 * LangChain Configuration Module
 *
 * Provides factory functions and configuration constants for initializing
 * LangChain chat models (ChatOpenAI) used for fishing analysis.
 *
 * Supports vision-capable models (gpt-4-vision-preview, gpt-4o, etc.) for
 * image analysis tasks.
 *
 * @example
 * import { createChatModel } from './config/langchain';
 * 
 * const chatModel = createChatModel(userApiKey, 'gpt-4o');
 * const response = await chatModel.invoke([
 *   { role: 'user', content: 'Analyze this fishing spot' }
 * ]);
 */

import { ChatOpenAI } from '@langchain/openai';

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
 * Value: 30000ms (30 seconds)
 */
export const LANGCHAIN_TIMEOUT_MS = 30000 as const;

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
 * Create a configured ChatOpenAI instance for fishing analysis.
 * 
 * Initializes a LangChain ChatOpenAI model with standard configuration:
 * - Temperature: 0.7 (balanced creativity/consistency)
 * - Timeout: 30s (photo analysis)
 * - Max tokens: 4096 (sufficient for analysis responses)
 * - No retries (handled at application level)
 * 
 * Vision support is automatically enabled for vision-capable models
 * (e.g., gpt-4-vision-preview, gpt-4o, gpt-4-turbo).
 *  * **Important:** The model must be vision-capable to support image analysis.
 * Use models like 'gpt-4o', 'gpt-4-vision-preview', or 'gpt-4-turbo' for
 * fishing spot analysis from photos.
 *  * @param apiKey - User's OpenAI API key (required for BYO-API-key model)
 * @param modelName - OpenAI model identifier (e.g., 'gpt-4o', 'gpt-4-vision-preview')
 * @returns Configured ChatOpenAI instance ready for inference
 * 
 * @example
 * const chatModel = createChatModel(userApiKey, 'gpt-4o');
 * 
 * // Use with vision (image URLs in messages)
 * const response = await chatModel.invoke([
 *   {
 *     role: 'user',
 *     content: [
 *       { type: 'text', text: 'Analyze this fishing spot' },
 *       { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }
 *     ]
 *   }
 * ]);
 * 
 * @throws Error if API key is invalid (thrown by OpenAI SDK during first request)
 */
export function createChatModel(apiKey: string, modelName: string): ChatOpenAI {
  return new ChatOpenAI({
    // @langchain/openai v1 expects `apiKey` + `model`.
    // Using these fields ensures BYO keys from settings are actually forwarded.
    apiKey,
    model: modelName,
    temperature: LANGCHAIN_TEMPERATURE,
    maxTokens: LANGCHAIN_MAX_TOKENS,
    timeout: LANGCHAIN_TIMEOUT_MS,
    maxRetries: 0, // Retries handled at application level
  });
}
