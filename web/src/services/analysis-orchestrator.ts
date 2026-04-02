/**
 * Analysis Orchestrator
 * 
 * Coordinates the full analysis pipeline:
 * 1. Image processing (downscaling)
 * 2. Enrichment (geocoding, weather, solar)
 * 3. AI analysis (LangChain + OpenAI vision)
 * 4. Validation (Zod schemas + geometry)
 * 
 * Provides progress callbacks for UI updates.
 */

import { processImage } from './image-processor';
import { enrichMetadata, type EnrichmentResults } from './enrichment';
import { 
  analyzeWithLangChain, 
  LangChainError,
  type AnalysisRequest as LangChainAnalysisRequest,
} from './langchain-chain';
import type { GearType } from '../types/contracts';

// ============================================================================
// Types
// ============================================================================

export interface AnalysisProgress {
  stage: 'processing' | 'enriching' | 'analyzing' | 'validating' | 'complete';
  message: string;
  progress: number; // 0-1
}

export interface AnalysisError {
  code: 'NO_API_KEY' | 'NO_GPS' | 'INVALID_MEDIA' | 'AI_TIMEOUT' | 'AI_RATE_LIMITED' | 
        'AI_INVALID_KEY' | 'NETWORK_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN';
  message: string;
  retryable: boolean;
  details?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ type: string; message: string; path?: string }>;
  warnings: Array<{ type: string; message: string; path?: string }>;
  parsed?: unknown;
}

export interface AnalysisOptions {
  mode: 'general' | 'specific';
  targetSpecies?: string;
  platform?: 'shore' | 'kayak' | 'boat';
  gearType?: GearType;
  lures_available?: string[];
  model?: string;
}

export interface AnalysisResult {
  success: boolean;
  data?: {
    result: unknown;
    enrichment: EnrichmentResults;
    validation: ValidationResult;
    model: string;
    timings: {
      processing_ms: number;
      enrichment_ms: number;
      ai_ms: number;
      validation_ms: number;
      total_ms: number;
    };
  };
  error?: AnalysisError;
}

export interface AnalysisInput {
  photoUri: string;
  location?: {
    lat: number;
    lon: number;
  };
  options: AnalysisOptions;
  apiKey: string;
  model?: string;
  sessionId?: string;
  onProgress?: (progress: AnalysisProgress) => void;
}

// ============================================================================
// Error Handling
// ============================================================================

function createAnalysisError(
  code: AnalysisError['code'],
  message: string,
  retryable: boolean = false,
  details?: unknown
): AnalysisError {
  return { code, message, retryable, details };
}

function handleError(error: unknown): AnalysisError {
  console.error('[Orchestrator] Analysis failed:', error);

  // Handle LangChain errors
  if (error instanceof LangChainError) {
    const codeMapping: Record<LangChainError['code'], AnalysisError['code']> = {
      'AI_TIMEOUT': 'AI_TIMEOUT',
      'AI_RATE_LIMITED': 'AI_RATE_LIMITED',
      'AI_INVALID_KEY': 'AI_INVALID_KEY',
      'AI_NETWORK_ERROR': 'NETWORK_ERROR',
      'AI_PARSE_ERROR': 'VALIDATION_ERROR',
      'AI_PROVIDER_ERROR': 'NETWORK_ERROR'
    };

    return createAnalysisError(
      codeMapping[error.code] || 'UNKNOWN',
      error.message,
      error.retryable,
      error.details
    );
  }

  // Handle network errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
      return createAnalysisError(
        'NETWORK_ERROR',
        'Network error. Please check your connection and try again.',
        true
      );
    }
  }

  // Generic error
  return createAnalysisError(
    'UNKNOWN',
    error instanceof Error ? error.message : 'An unexpected error occurred',
    false
  );
}

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Run full analysis pipeline
 * 
 * @param input - Analysis input with photo URI, location, options, API key, and AI model
 * @returns Analysis result with data or error
 */
export async function runAnalysis(input: AnalysisInput & { model: string }): Promise<AnalysisResult> {
  const { photoUri, location, options, apiKey, model, sessionId, onProgress } = input;
  const startTime = Date.now();

  const timings = {
    processing_ms: 0,
    enrichment_ms: 0,
    ai_ms: 0,
    validation_ms: 0,
    total_ms: 0
  };

  try {
    // Validate inputs
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        error: createAnalysisError(
          'NO_API_KEY',
          'No API key configured. Please set your OpenAI API key in settings.',
          false
        )
      };
    }

    // ========================================================================
    // Stage 1: Image Processing
    // ========================================================================
    onProgress?.({
      stage: 'processing',
      message: 'Processing image...',
      progress: 0.1
    });

    const processingStart = Date.now();
    const processedImage = await processImage(photoUri);
    timings.processing_ms = Date.now() - processingStart;

    console.log('[Orchestrator] Image processed', {
      width: processedImage.width,
      height: processedImage.height,
      wasResized: processedImage.wasResized,
      duration: timings.processing_ms
    });

    // ========================================================================
    // Stage 2: Enrichment
    // ========================================================================
    onProgress?.({
      stage: 'enriching',
      message: 'Gathering environmental data...',
      progress: 0.3
    });

    const enrichmentStart = Date.now();
    const enrichmentResult = await enrichMetadata(location);
    timings.enrichment_ms = Date.now() - enrichmentStart;

    console.log('[Orchestrator] Enrichment complete', {
      status: enrichmentResult.status,
      overallStatus: enrichmentResult.overallStatus,
      duration: timings.enrichment_ms
    });

    // ========================================================================
    // Stage 3: AI Analysis
    // ========================================================================
    onProgress?.({
      stage: 'analyzing',
      message: 'Analyzing fishing opportunities...',
      progress: 0.5
    });

    const aiStart = Date.now();
    
    // Use LangChain for AI analysis
    const langchainRequest: LangChainAnalysisRequest = {
      modelName: model,
      imageBase64: processedImage.base64,
      imageWidth: processedImage.width,
      imageHeight: processedImage.height,
      enrichment: enrichmentResult.results,
      location,
      options,
      apiKey,
      sessionId
    };

    const langchainResult = await analyzeWithLangChain(langchainRequest);

    if (!langchainResult.success) {
      // Return error immediately without throwing
      // Map LangChain error codes to orchestrator error codes
      const codeMapping: Record<string, AnalysisError['code']> = {
        'AI_TIMEOUT': 'AI_TIMEOUT',
        'AI_RATE_LIMITED': 'AI_RATE_LIMITED',
        'AI_INVALID_KEY': 'AI_INVALID_KEY',
        'AI_NETWORK_ERROR': 'NETWORK_ERROR',
        'AI_PARSE_ERROR': 'VALIDATION_ERROR',
        'AI_PROVIDER_ERROR': 'NETWORK_ERROR'
      };

      return {
        success: false,
        error: createAnalysisError(
          codeMapping[langchainResult.error.code] || 'UNKNOWN',
          langchainResult.error.message,
          langchainResult.error.retryable,
          langchainResult.error.details
        )
      };
    }

    // Use LangChain result (pre-validated by withStructuredOutput + Zod)
    const aiResult = {
      model: langchainResult.model,
      result: langchainResult.data
    };
    const modelUsed = langchainResult.model;

    timings.ai_ms = Date.now() - aiStart;

    console.log('[Orchestrator] LangChain analysis complete', {
      model: modelUsed,
      duration: timings.ai_ms
    });

    // ========================================================================
    // Stage 4: Validation
    // ========================================================================
    // Note: LangChain pre-validates output in the analysis chain,
    // so this stage mostly tracks timing for consistency
    onProgress?.({
      stage: 'validating',
      message: 'Validating results...',
      progress: 0.9
    });

    const validationStart = Date.now();
    
    // LangChain already validated via Zod schemas
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      parsed: aiResult.result
    };
    
    timings.validation_ms = Date.now() - validationStart;

    console.log('[Orchestrator] Validation complete (pre-validated by LangChain)');

    // ========================================================================
    // Complete
    // ========================================================================
    timings.total_ms = Date.now() - startTime;

    onProgress?.({
      stage: 'complete',
      message: 'Analysis complete!',
      progress: 1.0
    });

    return {
      success: true,
      data: {
        result: aiResult.result,
        enrichment: enrichmentResult.results,
        validation,
        model: modelUsed,
        timings
      }
    };

  } catch (error) {
    timings.total_ms = Date.now() - startTime;

    return {
      success: false,
      error: handleError(error)
    };
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryable(error: AnalysisError): boolean {
  return error.retryable;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: AnalysisError): string {
  const messages: Record<AnalysisError['code'], string> = {
    'NO_API_KEY': 'Please configure your OpenAI API key in settings.',
    'NO_GPS': 'Location unavailable. Please enable location services.',
    'INVALID_MEDIA': 'Unable to process image. Please try capturing again.',
    'AI_TIMEOUT': 'Analysis timed out. Please try again.',
    'AI_RATE_LIMITED': 'OpenAI rate limit reached. Please wait a moment before trying again.',
    'AI_INVALID_KEY': 'Invalid OpenAI API key. Please check your settings.',
    'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
    'VALIDATION_ERROR': 'Results validation failed. Please try again.',
    'UNKNOWN': 'An unexpected error occurred. Please try again.'
  };

  return messages[error.code] || error.message;
}
