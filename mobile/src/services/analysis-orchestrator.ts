/**
 * Analysis Orchestrator (Mobile)
 * 
 * Coordinates the full analysis pipeline:
 * 1. Image processing (downscaling)
 * 2. Enrichment (geocoding, weather, solar)
 * 3. AI analysis (OpenAI vision)
 * 4. Validation (schema + geometry)
 * 
 * Provides progress callbacks for UI updates.
 */

import { processImage } from './image-processor';
import { enrichMetadata, EnrichmentResults } from './enrichment';
import { analyzeImage, AnalysisOptions, AIClientError } from './ai-client';
import { validateAIResult, ValidationResult } from './validation';

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
  location: {
    lat: number;
    lon: number;
  };
  options: AnalysisOptions;
  apiKey: string;
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

  // Handle AI client errors
  if (error instanceof AIClientError) {
    const codeMapping: Record<AIClientError['code'], AnalysisError['code']> = {
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
      error.retryable
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
 * @param input - Analysis input with photo URI, location, options, and API key
 * @returns Analysis result with data or error
 */
export async function runAnalysis(input: AnalysisInput): Promise<AnalysisResult> {
  const { photoUri, location, options, apiKey, onProgress } = input;
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

    if (!location || location.lat < -90 || location.lat > 90 || 
        location.lon < -180 || location.lon > 180) {
      return {
        success: false,
        error: createAnalysisError(
          'NO_GPS',
          'Invalid GPS location. Please enable location services.',
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
    const aiResult = await analyzeImage(
      processedImage.base64,
      processedImage.width,
      processedImage.height,
      enrichmentResult.results,
      location,
      options,
      apiKey
    );
    timings.ai_ms = Date.now() - aiStart;

    console.log('[Orchestrator] AI analysis complete', {
      model: aiResult.model,
      duration: timings.ai_ms
    });

    // ========================================================================
    // Stage 4: Validation
    // ========================================================================
    onProgress?.({
      stage: 'validating',
      message: 'Validating results...',
      progress: 0.9
    });

    const validationStart = Date.now();
    const validation = validateAIResult(aiResult.rawResponse);
    timings.validation_ms = Date.now() - validationStart;

    if (!validation.valid) {
      console.warn('[Orchestrator] Validation failed', {
        errorCount: validation.errors.length,
        errors: validation.errors
      });

      return {
        success: false,
        error: createAnalysisError(
          'VALIDATION_ERROR',
          'AI output validation failed. Please try again.',
          true,
          { validationErrors: validation.errors }
        )
      };
    }

    console.log('[Orchestrator] Validation passed');

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
        result: validation.parsed || aiResult.result,
        enrichment: enrichmentResult.results,
        validation,
        model: aiResult.model,
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
