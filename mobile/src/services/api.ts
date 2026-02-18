/**
 * CastSense API Service
 * 
 * Handles communication with the CastSense backend:
 * - Multipart upload for media + metadata
 * - Authorization with Bearer token
 * - Timeout handling
 * - Retry logic per spec §10.2
 */

import axios, {
  type AxiosInstance,
  type AxiosProgressEvent,
  type AxiosError,
  type AxiosRequestConfig,
} from 'axios';
import {Platform} from 'react-native';
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
// API Client Setup
// ─────────────────────────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: apiConfig.baseUrl,
  timeout: apiConfig.uploadTimeoutMs,
  headers: {
    Accept: 'application/json',
  },
});

// Add auth header to all requests
apiClient.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  const authHeaders = getAuthHeaders();
  Object.assign(config.headers, authHeaders);
  return config;
});

// ─────────────────────────────────────────────────────────────────────────────
// Analyze Media (Main API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload media and metadata for analysis
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
        await delay(apiConfig.retryDelayMs);
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
 * Internal upload and analyze function
 */
async function uploadAndAnalyze(
  media: MediaFile,
  metadata: CastSenseRequestMetadata,
  onProgress?: ProgressCallback
): Promise<AnalyzeResponse> {
  // Build multipart form data
  const formData = new FormData();

  // Add media file
  const fileName = media.fileName || getDefaultFileName(media.mimeType);
  formData.append('media', {
    uri: media.uri,
    type: media.mimeType,
    name: fileName,
  } as unknown as Blob);

  // Add metadata as JSON string
  formData.append('metadata', JSON.stringify(metadata));

  // Configure request
  const config: AxiosRequestConfig = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: apiConfig.uploadTimeoutMs + apiConfig.analysisTimeoutMs,
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (onProgress && event.total) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    },
  };

  // Make request
  const response = await apiClient.post<CastSenseResponseEnvelope>(
    endpoints.analyze,
    formData,
    config
  );

  // Check response status
  if (response.data.status === 'error') {
    const errorData = response.data as unknown as {
      error?: {
        code: string;
        message: string;
        retryable: boolean;
        details?: Record<string, unknown>;
      };
    };
    return {
      success: false,
      error: errorData.error || {
        code: 'UNKNOWN',
        message: 'Server returned error status',
        retryable: false,
      },
    };
  }

  return {
    success: true,
    data: response.data as CastSenseResponseEnvelope & {
      result?: CastSenseAnalysisResult;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check backend health
 */
export async function checkHealth(): Promise<{
  healthy: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const response = await apiClient.get<{
      status: string;
      version?: string;
    }>(endpoints.health, {
      timeout: 5000,
    });
    
    return {
      healthy: response.data.status === 'ok',
      version: response.data.version,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
 * Parse error from axios or api response
 */
function parseApiError(error: unknown): {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
} {
  // Network errors
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      error?: {
        code: string;
        message: string;
        retryable: boolean;
        details?: Record<string, unknown>;
      };
    }>;

    // No response (network error)
    if (!axiosError.response) {
      return {
        code: 'NO_NETWORK',
        message: 'Unable to connect to server. Please check your internet connection.',
        retryable: true,
      };
    }

    // Handle specific HTTP status codes
    switch (axiosError.response.status) {
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
        const errorData = axiosError.response.data?.error;
        if (errorData) {
          return {
            code: (errorData.code as ApiErrorCode) || 'UNKNOWN',
            message: errorData.message || 'Invalid request',
            retryable: errorData.retryable ?? false,
            details: errorData.details,
          };
        }
        return {
          code: 'INVALID_MEDIA',
          message: 'Invalid media file. Please try a different photo or video.',
          retryable: false,
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
        // Try to extract error from response
        const responseError = axiosError.response.data?.error;
        if (responseError) {
          return {
            code: (responseError.code as ApiErrorCode) || 'UNKNOWN',
            message: responseError.message || 'An error occurred',
            retryable: responseError.retryable ?? false,
            details: responseError.details,
          };
        }
    }
  }

  // Unknown error
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

/**
 * Cancel token for request cancellation
 */
export function createCancelToken() {
  return axios.CancelToken.source();
}

/**
 * Check if error is a cancellation
 */
export function isCancel(error: unknown): boolean {
  return axios.isCancel(error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Client for Advanced Use
// ─────────────────────────────────────────────────────────────────────────────

export { apiClient };
