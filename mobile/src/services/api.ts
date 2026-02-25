/**
 * CastSense API Service
 * 
 * Handles communication with the CastSense backend using native fetch:
 * - Multipart upload for media + metadata (via XMLHttpRequest for progress)
 * - Authorization with Bearer token
 * - Timeout handling with AbortController
 * - Retry logic per spec §10.2
 * - Progress tracking for uploads
 */

import {
  apiConfig,
  getEndpointUrl,
  getAuthHeaders,
  endpoints,
} from '../config/api';
import {
  type CastSenseRequestMetadata,
  type CastSenseResponseEnvelope,
  type CastSenseAnalysisResult,
} from '../types/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MediaFile {
  uri: string;
  mimeType: string;
  fileName?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  data?: CastSenseResponseEnvelope & {
    result?: CastSenseAnalysisResult;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: UploadProgress) => void;

// ─────────────────────────────────────────────────────────────────────────────
// AbortController Wrapper for Cancellation
// ─────────────────────────────────────────────────────────────────────────────

export interface CancelTokenSource {
  token: AbortSignal;
  abort: () => void;
}

/**
 * Create a cancellable request token (compatible with old axios API)
 */
export function createCancelToken(): CancelTokenSource {
  const controller = new AbortController();
  return {
    token: controller.signal,
    abort: () => controller.abort(),
  };
}

/**
 * Check if error is a cancellation/abort
 */
export function isCancel(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.includes('aborted');
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analyze Media (Main API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload media and metadata for analysis
 * Uses XMLHttpRequest for progress tracking (fetch + FormData doesn't support progress in RN)
 * Returns overlay-ready analysis result
 */
export async function analyzeMedia(
  media: MediaFile,
  metadata: CastSenseRequestMetadata,
  onProgress?: ProgressCallback
): Promise<AnalyzeResponse> {
  let lastError: AnalyzeResponse['error'] | undefined;
  
  // Attempt with retry logic
  for (let attempt = 0; attempt <= apiConfig.retryAttempts; attempt++) {
    try {
      const response = await uploadAndAnalyze(media, metadata, onProgress);
      return response;
    } catch (error) {
      const apiError = parseApiError(error);
      lastError = apiError;
      
      // Check if we should retry per §10.2
      const shouldRetry = 
        attempt < apiConfig.retryAttempts &&
        apiError.retryable &&
        (apiError.code === 'AI_TIMEOUT' || apiError.code === 'ENRICHMENT_FAILED');
      
      if (shouldRetry) {
        console.log(`Retrying request (attempt ${attempt + 1}/${apiConfig.retryAttempts})...`);
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delayMs = apiConfig.retryDelayMs * Math.pow(2, attempt);
        await delay(delayMs);
        continue;
      }
      
      // No retry, return error
      return {
        success: false,
        error: apiError,
      };
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError || {
      code: 'UNKNOWN',
      message: 'Request failed after retries',
      retryable: false,
    },
  };
}

/**
 * Internal upload and analyze function using XMLHttpRequest for progress tracking
 * (native fetch + FormData doesn't support progress tracking in React Native)
 */
async function uploadAndAnalyze(
  media: MediaFile,
  metadata: CastSenseRequestMetadata,
  onProgress?: ProgressCallback
): Promise<AnalyzeResponse> {
  const url = `${apiConfig.baseUrl}${endpoints.analyze}`;
  const authHeaders = getAuthHeaders();
  
  // Diagnostic logging
  console.log('📤 API Request:', {
    url,
    method: 'POST',
    hasAuth: !!authHeaders.Authorization,
    mediaType: media.mimeType,
    timestamp: new Date().toISOString(),
  });
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Setup progress tracking
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      });
    }
    
    // Setup completion handler
    xhr.addEventListener('load', () => {
      try {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Success response
          const responseText = xhr.responseText;
          const responseData = JSON.parse(responseText) as CastSenseResponseEnvelope;
          
          // Check response status
          if (responseData.status === 'error') {
            const errorData = responseData as unknown as {
              error?: {
                code: string;
                message: string;
                retryable: boolean;
                details?: Record<string, unknown>;
              };
            };
            reject(new ApiHttpError(
              xhr.status,
              errorData.error || {
                code: 'UNKNOWN',
                message: 'Server returned error status',
                retryable: false,
              }
            ));
          } else {
            resolve({
              success: true,
              data: responseData as CastSenseResponseEnvelope & {
                result?: CastSenseAnalysisResult;
              },
            });
          }
        } else {
          // HTTP error response
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new ApiHttpError(xhr.status, errorData.error));
          } catch {
            reject(new ApiHttpError(xhr.status, {
              code: 'UNKNOWN',
              message: `HTTP ${xhr.status}`,
              retryable: false,
            }));
          }
        }
      } catch (error) {
        reject(new ApiParseError('Failed to parse response', error));
      }
    });
    
    // Setup error handler
    xhr.addEventListener('error', () => {
      console.error('❌ XHR error event:', {
        status: xhr.status,
        statusText: xhr.statusText,
        responseText: xhr.responseText?.substring(0, 200),
        headers: {
          'Content-Type': xhr.getResponseHeader('content-type'),
          'Access-Control-Allow-Origin': xhr.getResponseHeader('access-control-allow-origin'),
        },
      });
      reject(new ApiNetworkError('Network error during upload'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });
    
    // Setup timeout
    const totalTimeoutMs = apiConfig.uploadTimeoutMs + apiConfig.analysisTimeoutMs;
    xhr.timeout = totalTimeoutMs;
    console.log('⏱️ Request timeout set to:', totalTimeoutMs + 'ms');
    xhr.addEventListener('timeout', () => {
      console.error('⏱️ Request timed out after', totalTimeoutMs + 'ms');
      reject(new ApiTimeoutError('Request timeout'));
    });
    
    // Build multipart form data using React Native's FormData API
    const formData = new FormData();
    
    // Add media file - React Native expects {uri, type, name}
    const fileName = media.fileName || getDefaultFileName(media.mimeType);
    formData.append('media', {
      uri: media.uri,
      type: media.mimeType,
      name: fileName,
    } as unknown as Blob);
    
    // Add metadata as JSON string
    formData.append('metadata', JSON.stringify(metadata));
    
    // Open and configure request
    console.log('🔗 Opening XHR connection to:', url);
    xhr.open('POST', url, true);
    
    // Add authorization header
    xhr.setRequestHeader('Authorization', authHeaders.Authorization);
    console.log('🔑 Authorization header set');
    
    // Send request (don't set Content-Type, let the XMLHttpRequest set it with boundary)
    console.log('📨 Sending request with FormData');
    xhr.send(formData);
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check backend health using native fetch
 */
export async function checkHealth(): Promise<{
  healthy: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${apiConfig.baseUrl}${endpoints.health}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        healthy: false,
        error: `HTTP ${response.status}`,
      };
    }
    
    const data = await response.json() as {
      status: string;
      version?: string;
    };
    
    return {
      healthy: data.status === 'ok',
      version: data.version,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        healthy: false,
        error: 'Health check timeout',
      };
    }
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}



// ─────────────────────────────────────────────────────────────────────────────
// Custom Error Classes
// ─────────────────────────────────────────────────────────────────────────────

class ApiNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiNetworkError';
  }
}

class ApiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

class ApiHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorData: {
      code: string;
      message: string;
      retryable: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    super(errorData.message);
    this.name = 'ApiHttpError';
  }
}

class ApiParseError extends Error {
  constructor(message: string, readonly cause: unknown) {
    super(message);
    this.name = 'ApiParseError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error codes per spec §10.1
 */
export type ApiErrorCode =
  | 'NO_GPS'
  | 'NO_NETWORK'
  | 'INVALID_MEDIA'
  | 'AI_TIMEOUT'
  | 'ENRICHMENT_FAILED'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'UNKNOWN';

/**
 * Parse error from fetch, XMLHttpRequest, or API response
 */
function parseApiError(error: unknown): {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
} {
  // Network errors (no connection)
  if (error instanceof ApiNetworkError) {
    return {
      code: 'NO_NETWORK',
      message: 'Unable to connect to server. Please check your internet connection.',
      retryable: true,
    };
  }
  
  // Timeout errors
  if (error instanceof ApiTimeoutError) {
    return {
      code: 'AI_TIMEOUT',
      message: 'Analysis took too long. Please try again.',
      retryable: true,
    };
  }
  
  // HTTP errors
  if (error instanceof ApiHttpError) {
    const {statusCode, errorData} = error;
    
    // Handle specific HTTP status codes
    switch (statusCode) {
      case 401:
        return {
          code: 'UNAUTHORIZED',
          message: 'Authentication failed. Please restart the app.',
          retryable: false,
        };
      
      case 429:
        return {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment and try again.',
          retryable: true,
        };
      
      case 408:
      case 504:
        return {
          code: 'AI_TIMEOUT',
          message: 'Analysis took too long. Please try again.',
          retryable: true,
        };
      
      case 400:
        // Check for specific error in response body
        return {
          code: (errorData.code as ApiErrorCode) || 'INVALID_MEDIA',
          message: errorData.message || 'Invalid request',
          retryable: errorData.retryable ?? false,
          details: errorData.details,
        };
      
      case 500:
      case 502:
      case 503:
        return {
          code: 'UNKNOWN',
          message: 'Server error. Please try again later.',
          retryable: true,
        };
      
      default:
        // Use error from response if available
        return {
          code: (errorData.code as ApiErrorCode) || 'UNKNOWN',
          message: errorData.message || 'An error occurred',
          retryable: errorData.retryable ?? false,
          details: errorData.details,
        };
    }
  }
  
  // Parse errors
  if (error instanceof ApiParseError) {
    return {
      code: 'UNKNOWN',
      message: 'Failed to parse server response',
      retryable: true,
    };
  }
  
  // Abort/cancellation errors
  if (error instanceof Error && (error.name === 'AbortError' || isCancel(error))) {
    return {
      code: 'UNKNOWN',
      message: 'Request cancelled',
      retryable: false,
    };
  }
  
  // Unknown errors
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    retryable: false,
  };
}



// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get default filename based on mime type
 */
function getDefaultFileName(mimeType: string): string {
  const timestamp = Date.now();
  
  if (mimeType.startsWith('video/')) {
    return `capture_${timestamp}.mp4`;
  }
  
  return `capture_${timestamp}.jpg`;
}

/**
 * Delay helper for retry logic
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
