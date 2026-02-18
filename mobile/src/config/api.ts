/**
 * CastSense API Configuration
 * 
 * Environment-based configuration for API endpoints and settings.
 * Uses the centralized environment configuration from env.ts.
 */

import { env, isDev, validateEnvironment } from './env';

// Validate environment on import (warns in dev, throws in prod)
validateEnvironment();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  uploadTimeoutMs: number;
  analysisTimeoutMs: number;
  maxPhotoSizeMb: number;
  maxVideoSizeMb: number;
  maxVideoDurationSec: number;
  photoMaxLongEdge: number;
  videoMaxResolution: number;
  retryAttempts: number;
  retryDelayMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * API configuration loaded from environment
 * 
 * Base URL and API key come from env.ts (react-native-config).
 * Other values are constants that match backend constraints.
 */
export const apiConfig: ApiConfig = {
  // From environment configuration
  baseUrl: env.apiBaseUrl,
  apiKey: env.apiKey,
  
  // Timeouts
  uploadTimeoutMs: 60000, // 60s for upload
  analysisTimeoutMs: 30000, // 30s for analysis
  
  // Media constraints (must match backend MAX_PHOTO_BYTES, MAX_VIDEO_BYTES)
  maxPhotoSizeMb: 8,
  maxVideoSizeMb: 25,
  maxVideoDurationSec: 10,
  photoMaxLongEdge: 1920,
  videoMaxResolution: 720,
  
  // Retry settings
  retryAttempts: isDev ? 1 : 2,
  retryDelayMs: 1000,
};

// ─────────────────────────────────────────────────────────────────────────────
// API Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const endpoints = {
  analyze: '/v1/analyze',
  health: '/v1/health',
} as const;

/**
 * Get full URL for an endpoint
 */
export function getEndpointUrl(endpoint: keyof typeof endpoints): string {
  return `${apiConfig.baseUrl}${endpoints[endpoint]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Headers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get authorization headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiConfig.apiKey}`,
  };
}

/**
 * Get common headers for JSON requests
 */
export function getJsonHeaders(): Record<string, string> {
  return {
    ...getAuthHeaders(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Size Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_PHOTO_BYTES = apiConfig.maxPhotoSizeMb * 1024 * 1024;
export const MAX_VIDEO_BYTES = apiConfig.maxVideoSizeMb * 1024 * 1024;
export const MAX_VIDEO_DURATION_MS = apiConfig.maxVideoDurationSec * 1000;
