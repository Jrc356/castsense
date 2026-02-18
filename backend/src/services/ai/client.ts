/**
 * AI Provider Client Wrapper (T4.1)
 * 
 * Unified client for calling multimodal AI models using OpenAI-compatible API format.
 * Supports both photo (single image) and video (multiple keyframe images) inputs.
 */

import pino from 'pino';
import {
  AICallOptions,
  AIResponse,
  AIClientConfig,
  AIError,
  AIErrorCode,
  ChatMessage
} from '../../types/ai';

const logger = pino({ name: 'ai-client' });

/**
 * Default configuration values
 */
const DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  timeoutMsPhoto: 12000,
  timeoutMsVideo: 18000
} as const;

/**
 * Get AI client configuration from environment variables
 */
export function getAIConfig(): AIClientConfig {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  
  if (!apiKey) {
    throw createAIError(
      'AI_PROVIDER_ERROR',
      'AI_PROVIDER_API_KEY environment variable is not set',
      false
    );
  }

  return {
    apiKey,
    baseUrl: process.env.AI_PROVIDER_BASE_URL || DEFAULTS.baseUrl,
    model: process.env.AI_MODEL || DEFAULTS.model,
    timeoutMsPhoto: parseInt(process.env.AI_TIMEOUT_MS_PHOTO || '', 10) || DEFAULTS.timeoutMsPhoto,
    timeoutMsVideo: parseInt(process.env.AI_TIMEOUT_MS_VIDEO || '', 10) || DEFAULTS.timeoutMsVideo
  };
}

/**
 * Creates a structured AI error
 */
export function createAIError(
  code: AIErrorCode,
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>
): AIError {
  const error = new Error(message) as AIError;
  error.code = code;
  error.retryable = retryable;
  error.details = details;
  error.name = 'AIError';
  return error;
}

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // Check if it's an AIError with retryable flag
  if (error && typeof error === 'object' && 'retryable' in error) {
    return (error as AIError).retryable === true;
  }

  // Check for specific error codes
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as AIError).code;
    const retryableCodes: AIErrorCode[] = ['AI_TIMEOUT', 'AI_RATE_LIMITED', 'AI_NETWORK_ERROR'];
    return retryableCodes.includes(code);
  }

  // Check for network-level errors that are typically retryable
  if (error instanceof Error) {
    const retryableMessages = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'socket hang up',
      'network',
      'timeout'
    ];
    const message = error.message.toLowerCase();
    return retryableMessages.some(m => message.includes(m.toLowerCase()));
  }

  return false;
}

/**
 * Encodes a buffer to base64 data URL format
 */
function encodeImageToDataUrl(buffer: Buffer, mimeType: string = 'image/jpeg'): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Builds a multimodal chat message with images
 */
function buildMultimodalMessage(prompt: string, images: Buffer[]): ChatMessage {
  const content: ChatMessage['content'] = [];

  // Add the text prompt first
  content.push({
    type: 'text',
    text: prompt
  });

  // Add all images
  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: encodeImageToDataUrl(image),
        detail: 'high'
      }
    });
  }

  return {
    role: 'user',
    content
  };
}

/**
 * Parse error response from API
 */
function parseAPIError(response: Response, body: unknown): AIError {
  const statusCode = response.status;
  
  // Rate limited
  if (statusCode === 429) {
    return createAIError(
      'AI_RATE_LIMITED',
      'AI provider rate limit exceeded',
      true,
      { statusCode, body }
    );
  }

  // Server errors are typically retryable
  if (statusCode >= 500) {
    return createAIError(
      'AI_PROVIDER_ERROR',
      `AI provider server error: ${statusCode}`,
      true,
      { statusCode, body }
    );
  }

  // Client errors (4xx except 429) are not retryable
  return createAIError(
    'AI_PROVIDER_ERROR',
    `AI provider error: ${statusCode}`,
    false,
    { statusCode, body }
  );
}

/**
 * Calls the AI provider with a prompt and images
 * 
 * @param prompt - The text prompt to send
 * @param images - Array of image buffers (1 for photo, multiple for video keyframes)
 * @param options - Call options including timeout and optional model override
 * @returns AI response with content and metadata
 */
export async function callAI(
  prompt: string,
  images: Buffer[],
  options: AICallOptions
): Promise<AIResponse> {
  const config = getAIConfig();
  const model = options.model || config.model;
  const timeoutMs = options.timeout_ms;

  logger.info({
    model,
    timeoutMs,
    imageCount: images.length,
    promptLength: prompt.length
  }, 'Starting AI call');

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startTime = Date.now();

    // Build the request
    const messages: ChatMessage[] = [
      buildMultimodalMessage(prompt, images)
    ];

    const requestBody = {
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    };

    // Make the API call
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const duration = Date.now() - startTime;
    clearTimeout(timeoutId);

    // Parse response
    const responseBody = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      error?: { message?: string };
    };

    // Handle API errors
    if (!response.ok) {
      logger.error({
        statusCode: response.status,
        error: responseBody.error,
        duration
      }, 'AI API error');
      throw parseAPIError(response, responseBody);
    }

    // Extract content
    const content = responseBody.choices?.[0]?.message?.content;
    if (!content) {
      throw createAIError(
        'AI_INVALID_RESPONSE',
        'AI response missing content',
        false,
        { responseBody }
      );
    }

    logger.info({
      model: responseBody.model || model,
      duration,
      promptTokens: responseBody.usage?.prompt_tokens,
      completionTokens: responseBody.usage?.completion_tokens,
      totalTokens: responseBody.usage?.total_tokens
    }, 'AI call completed');

    return {
      content,
      model: responseBody.model || model,
      usage: responseBody.usage
    };

  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn({
        timeoutMs,
        imageCount: images.length
      }, 'AI call timed out');
      
      throw createAIError(
        'AI_TIMEOUT',
        `AI call timed out after ${timeoutMs}ms`,
        true,
        { timeoutMs }
      );
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logger.error({ error }, 'AI network error');
      throw createAIError(
        'AI_NETWORK_ERROR',
        `Network error calling AI: ${error.message}`,
        true
      );
    }

    // Re-throw AIErrors as-is
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    // Wrap unknown errors
    logger.error({ error }, 'Unexpected AI error');
    throw createAIError(
      'AI_PROVIDER_ERROR',
      `Unexpected AI error: ${error instanceof Error ? error.message : 'Unknown'}`,
      false
    );
  }
}

/**
 * Reads images from file buffers and returns them ready for AI input
 * This is a pass-through for now but provides a hook for preprocessing
 */
export async function prepareImagesForAI(imageBuffers: Buffer[]): Promise<Buffer[]> {
  // For now, just return as-is. This could include:
  // - Resizing if needed
  // - Format conversion
  // - Quality optimization
  return imageBuffers;
}

export default {
  callAI,
  isRetryableError,
  createAIError,
  getAIConfig,
  prepareImagesForAI
};
