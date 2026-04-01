/**
 * LangChain Analysis Chain
 * 
 * Orchestrates the complete AI analysis flow using LangChain components:
 * 1. Model initialization (ChatOpenAI with vision support)
 * 2. Prompt formatting (context-aware template)
 * 3. Vision API invocation (HumanMessage with image content)
 * 4. Response parsing (Zod-based structured output validation)
 * 
 * This replaces direct OpenAI SDK calls in ai-client.ts with LangChain abstractions.
 * Maintains backward compatibility with existing error codes and interfaces.
 */

import { HumanMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { createChatModel } from '../config/langchain';
import { 
  buildContextPack, 
  formatAnalysisPrompt,
  type ContextPack,
  type AnalysisOptions 
} from './langchain-prompts';
import { 
  CastSenseResultSchema,
  validateGeometry,
  type CastSenseResult,
  type ValidationResult
} from './langchain-parsers';
import type { EnrichmentResults } from './enrichment';
import { 
  getConversationHistory, 
  addToMemory 
} from './langchain-memory';

// ============================================================================
// Types
// ============================================================================

/**
 * Error codes for LangChain analysis operations.
 * Maps to existing app error codes for consistency.
 */
export type LangChainErrorCode = 
  | 'AI_TIMEOUT'         // Request exceeded 120s timeout
  | 'AI_RATE_LIMITED'    // OpenAI rate limit hit
  | 'AI_INVALID_KEY'     // Invalid or unauthorized API key
  | 'AI_NETWORK_ERROR'   // Network/connection failure
  | 'AI_PARSE_ERROR'     // Failed to parse/validate AI response
  | 'AI_PROVIDER_ERROR'; // OpenAI service error (5xx)

/**
 * LangChain analysis error with retry hint
 */
export class LangChainError extends Error {
  code: LangChainErrorCode;
  retryable: boolean;
  details?: unknown;

  constructor(
    message: string,
    code: LangChainErrorCode,
    retryable: boolean = false,
    details?: unknown
  ) {
    super(message);
    this.name = 'LangChainError';
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

/**
 * Analysis request matching ai-client.ts interface for drop-in replacement
 */
export interface AnalysisRequest {
  /** OpenAI model identifier (must be vision-capable: gpt-4o, gpt-4-vision-preview, etc.) */
  modelName: string;
  
  /** Base64-encoded image data (without data URL prefix) */
  imageBase64: string;
  
  /** Image width in pixels */
  imageWidth: number;
  
  /** Image height in pixels */
  imageHeight: number;
  
  /** Enrichment data (location, weather, solar) */
  enrichment: EnrichmentResults;
  
  /** GPS coordinates */
  location: {
    lat: number;
    lon: number;
  };
  
  /** Analysis mode and options */
  options: AnalysisOptions;
  
  /** User's OpenAI API key (BYO-API-key model) */
  apiKey: string;
  
  /** Optional session ID for conversation memory (enables follow-up queries) */
  sessionId?: string;
}

/**
 * Successful analysis result with validated data
 */
export interface AnalysisSuccess {
  success: true;
  
  /** Validated and parsed CastSense result */
  data: CastSenseResult;
  
  /** Model name used for analysis */
  model: string;
  
  /** Validation report with any geometry/integrity warnings */
  validation: ValidationResult;
}

/**
 * Failed analysis result with error details
 */
export interface AnalysisFailure {
  success: false;
  
  /** Error information */
  error: {
    code: LangChainErrorCode;
    message: string;
    retryable: boolean;
    details?: unknown;
  };
}

/**
 * Analysis result union type
 */
export type AnalysisResult = AnalysisSuccess | AnalysisFailure;

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map LangChain/OpenAI errors to standardized error codes.
 * Preserves existing app error handling logic.
 */
function mapErrorToLangChainError(error: unknown): LangChainError {
  // Log full error details so HTTP status + OpenAI body are visible in devtools
  const httpStatus = (error as { status?: number })?.status;
  console.error('[LangChain Chain] Error during analysis:', error);
  if (httpStatus !== undefined) {
    console.error('[LangChain Chain] HTTP status:', httpStatus);
  }

  // Already a LangChainError - pass through
  if (error instanceof LangChainError) {
    return error;
  }

  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Timeout errors
    if (message.includes('timeout') || message.includes('aborted') || errorName.includes('timeout')) {
      return new LangChainError(
        'AI analysis timed out after 30 seconds. Please try again.',
        'AI_TIMEOUT',
        true,
        { originalError: error.message }
      );
    }

    // Network/connection errors
    if (message.includes('network') || 
        message.includes('fetch') || 
        message.includes('connection') ||
        message.includes('enotfound') ||
        message.includes('econnrefused')) {
      return new LangChainError(
        'Network error. Please check your internet connection and try again.',
        'AI_NETWORK_ERROR',
        true,
        { originalError: error.message }
      );
    }

    // OpenAI-specific errors (LangChain wraps APIError)
    if (message.includes('missing credentials') || message.includes('pass an `apikey`')) {
      return new LangChainError(
        'No API key configured. Please set your OpenAI API key in settings.',
        'AI_INVALID_KEY',
        false,
        { originalError: error.message }
      );
    }

    if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid api key')) {
      return new LangChainError(
        'Invalid API key. Please check your OpenAI API key in settings.',
        'AI_INVALID_KEY',
        false,
        { originalError: error.message }
      );
    }

    if (message.includes('429') || message.includes('rate limit')) {
      return new LangChainError(
        'OpenAI rate limit reached. Please wait a moment and try again.',
        'AI_RATE_LIMITED',
        true,
        { originalError: error.message }
      );
    }

    if (message.includes('500') || 
        message.includes('502') || 
        message.includes('503') || 
        message.includes('504') ||
        message.includes('service unavailable')) {
      return new LangChainError(
        'OpenAI service error. Please try again in a moment.',
        'AI_PROVIDER_ERROR',
        true,
        { originalError: error.message }
      );
    }

    // Parse/validation errors
    if (message.includes('parse') || 
        message.includes('json') || 
        message.includes('validation') ||
        message.includes('schema')) {
      return new LangChainError(
        'Failed to parse AI response. The model may have returned invalid data.',
        'AI_PARSE_ERROR',
        true, // Retryable - model might do better next time
        { originalError: error.message }
      );
    }

    // Generic error fallback
    return new LangChainError(
      `AI analysis failed: ${error.message}`,
      'AI_PROVIDER_ERROR',
      false,
      { originalError: error.message }
    );
  }

  // Unknown error type
  return new LangChainError(
    'An unexpected error occurred during analysis',
    'AI_PROVIDER_ERROR',
    false,
    { originalError: String(error) }
  );
}

// ============================================================================
// Main Analysis Chain
// ============================================================================

/**
 * Analyze fishing spot using LangChain + OpenAI vision.
 * 
 * This is the main entry point for AI analysis, replacing `analyzeImage()` 
 * from ai-client.ts. It orchestrates the full LangChain pipeline:
 * 
 * 1. **Context Building**: Convert enrichment data to structured ContextPack
 * 2. **Prompt Formatting**: Generate analysis prompt with environmental context
 * 3. **Model Invocation**: Call OpenAI vision model with image + prompt
 * 4. **Response Parsing**: Validate output against Zod schema
 * 5. **Error Handling**: Map errors to standardized codes
 * 
 * @param request - Analysis request with image, enrichment, options, and API key
 * @returns Analysis result with validated data or error details
 * 
 * @example
 * ```typescript
 * const result = await analyzeWithLangChain({
 *   modelName: 'gpt-4o',
 *   imageBase64: base64Data,
 *   imageWidth: 1024,
 *   imageHeight: 768,
 *   enrichment: enrichmentResult,
 *   location: { lat: 37.7749, lon: -122.4194 },
 *   options: { mode: 'general', platform: 'shore' },
 *   apiKey: userApiKey
 * });
 * 
 * if (result.success) {
 *   console.log('Analysis complete:', result.data);
 * } else {
 *   console.error('Analysis failed:', result.error);
 * }
 * ```
 */
export async function analyzeWithLangChain(
  request: AnalysisRequest
): Promise<AnalysisResult> {
  const {
    modelName,
    imageBase64,
    imageWidth,
    imageHeight,
    enrichment,
    location,
    options,
    apiKey,
    sessionId
  } = request;

  try {
    console.log('[LangChain Chain] Starting analysis', {
      model: modelName,
      mode: options.mode,
      targetSpecies: options.targetSpecies,
      imageSize: { width: imageWidth, height: imageHeight },
      hasSessionId: !!sessionId
    });

    // =========================================================================
    // Step 1: Initialize model
    // =========================================================================
    const chatModel = await createChatModel(apiKey, modelName);

    // =========================================================================
    // Step 2: Load conversation history (if session provided)
    // =========================================================================
    let conversationHistory: BaseMessage[] | undefined;
    
    if (sessionId) {
      conversationHistory = await getConversationHistory(sessionId);
      console.log('[LangChain Chain] Loaded conversation history', {
        sessionId,
        messageCount: conversationHistory.length
      });
    }

    // =========================================================================
    // Step 3: Build context pack and format prompt (with history)
    // =========================================================================
    const contextPack: ContextPack = buildContextPack(enrichment, location, options);
    const promptText = await formatAnalysisPrompt(contextPack, conversationHistory);

    console.log('[LangChain Chain] Prompt formatted', {
      promptLength: promptText.length,
      hasWeather: !!contextPack.weather,
      hasLocation: !!contextPack.location,
      hasTime: !!contextPack.time
    });

    // =========================================================================
    // Step 3: Create vision message with image (standard cross-provider format)
    // =========================================================================
    const message = new HumanMessage({
      content: [
        {
          type: 'text',
          text: promptText
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
            detail: 'high'
          }
        }
      ]
    });

    // =========================================================================
    // Step 4: Invoke model with structured output (Zod schema enforced)
    // withStructuredOutput uses OpenAI's native structured output (JSON mode /
    // tool calling) — eliminates manual JSON extraction and parsing.
    //
    // method: "functionCalling" — newer models (gpt-4o, gpt-5.x, etc.) default
    // to "jsonSchema" mode which requires every property in every nested object
    // to be listed in "required". Our schema uses .optional() for nullable
    // fields (selected_frame_index, alternate_rigs, etc.) which jsonSchema mode
    // rejects with HTTP 400. Forcing functionCalling honours optional fields
    // correctly via tool-calling. strict: false is kept so the underlying tool
    // definition also does not enforce required-only properties.
    // =========================================================================
    console.log('[LangChain Chain] Invoking model with structured output...');
    const structuredModel = chatModel.withStructuredOutput(CastSenseResultSchema, {
      method: 'functionCalling',
      strict: false
    });
    const parsedData = await structuredModel.invoke([message]) as CastSenseResult;

    if (!parsedData) {
      throw new LangChainError(
        'Empty response from AI model',
        'AI_PROVIDER_ERROR',
        true
      );
    }

    console.log('[LangChain Chain] Received structured response', {
      model: modelName,
      zones: parsedData.zones?.length ?? 0,
      tactics: parsedData.tactics?.length ?? 0
    });

    // =========================================================================
    // Step 5: Post-parse geometry & integrity validation
    // Zod schema covers coordinate bounds and type constraints; this adds
    // domain-level checks (zone-tactic consistency, etc.)
    // =========================================================================
    const geometryErrors = validateGeometry(parsedData);
    const validationResult: ValidationResult = {
      valid: geometryErrors.length === 0,
      errors: geometryErrors,
      parsed: parsedData
    };

    if (!validationResult.valid) {
      console.warn('[LangChain Chain] Geometry/integrity validation warnings', {
        errors: validationResult.errors
      });
    }

    // =========================================================================
    // Step 6: Inject analysis_frame metadata
    // =========================================================================
    const parsedDataWithFrame = {
      ...parsedData,
      analysis_frame: {
        type: 'photo' as const,
        width_px: imageWidth,
        height_px: imageHeight
      }
    };

    console.log('[LangChain Chain] Analysis complete', {
      zones: parsedDataWithFrame.zones.length,
      tactics: parsedDataWithFrame.tactics.length,
      hasWarnings: validationResult.errors.length > 0
    });

    // =========================================================================
    // Step 7: Store in conversation memory (if session provided)
    // =========================================================================
    if (sessionId) {
      await addToMemory(
        sessionId,
        promptText, // Store the full prompt as user message
        parsedDataWithFrame
      );
      console.log('[LangChain Chain] Stored result in memory for session:', sessionId);
    }

    // =========================================================================
    // Return success result
    // =========================================================================
    return {
      success: true,
      data: parsedDataWithFrame,
      model: modelName,
      validation: { ...validationResult, parsed: parsedDataWithFrame }
    };

  } catch (error) {
    // Map error to standardized format
    const mappedError = mapErrorToLangChainError(error);

    return {
      success: false,
      error: {
        code: mappedError.code,
        message: mappedError.message,
        retryable: mappedError.retryable,
        details: mappedError.details
      }
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Re-export types for convenience
  type ContextPack,
  type AnalysisOptions,
  type CastSenseResult,
  type ValidationResult
};
