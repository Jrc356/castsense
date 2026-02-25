/**
 * CastSense Mobile Environment Configuration (Expo)
 *
 * Type-safe environment loading with build-time injection support.
 * Uses expo-constants for environment variable access.
 *
 * Environment variables are injected at build time via:
 * - .env files (loaded by app.config.js)
 * - app.config.js extra field
 * - Build scripts
 *
 * @example
 * // In .env file:
 * API_BASE_URL=https://api.castsense.app
 * API_KEY=your-api-key
 *
 * // In code:
 * import { env } from './config/env';
 * console.log(env.apiBaseUrl);
 */

import Constants from 'expo-constants';

// ─────────────────────────────────────────────────────────────────────────────
// Environment Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Environment {
  /** Base URL for the CastSense API */
  apiBaseUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Current environment name */
  envName: 'development' | 'staging' | 'production';

  /** Whether debug features are enabled */
  debugEnabled: boolean;

  /** Whether analytics are enabled */
  analyticsEnabled: boolean;

  /** Sentry DSN for error reporting (optional) */
  sentryDsn: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expo Constants Access
// ─────────────────────────────────────────────────────────────────────────────

// Access environment variables from app.config.js's `extra` field
const expoExtra = (Constants.expoConfig?.extra || {}) as {
  apiBaseUrl?: string;
  apiKey?: string;
  environment?: string;
  debugEnabled?: string | boolean;
  analyticsEnabled?: string | boolean;
  sentryDsn?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Default Values
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  development: {
    apiBaseUrl: 'http://localhost:3000',
    apiKey: 'dev-api-key',
    envName: 'development' as const,
    debugEnabled: true,
    analyticsEnabled: false,
    sentryDsn: null,
  },
  staging: {
    apiBaseUrl: 'https://staging-api.castsense.app',
    apiKey: '', // Must be provided via env
    envName: 'staging' as const,
    debugEnabled: true,
    analyticsEnabled: true,
    sentryDsn: null,
  },
  production: {
    apiBaseUrl: 'https://api.castsense.app',
    apiKey: '', // Must be provided via env
    envName: 'production' as const,
    debugEnabled: false,
    analyticsEnabled: true,
    sentryDsn: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Environment Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the current environment based on __DEV__ and ENV_NAME
 */
function detectEnvironment(): 'development' | 'staging' | 'production' {
  // First check explicit environment from config
  const envName = expoExtra.environment?.toLowerCase();
  if (envName === 'production' || envName === 'prod') {
    return 'production';
  }
  if (envName === 'staging' || envName === 'stage') {
    return 'staging';
  }
  if (envName === 'development' || envName === 'dev') {
    return 'development';
  }

  // Fallback to __DEV__ detection
  return __DEV__ ? 'development' : 'production';
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a value is "empty" - handles null, undefined, empty strings, and empty objects
 * Expo may serialize null as empty objects {}, so we need to check for that
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

/**
 * Parse a boolean-like environment variable
 */
function parseBoolean(value: string | boolean | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Load environment configuration with proper fallbacks
 */
function loadEnvironment(): Environment {
  const currentEnv = detectEnvironment();
  const defaults = DEFAULTS[currentEnv];

  console.log('📋 Loading environment config:', {
    currentEnv,
    expoExtra,
    isApiBaseUrlEmpty: isEmpty(expoExtra.apiBaseUrl),
  });

  return {
    apiBaseUrl: isEmpty(expoExtra.apiBaseUrl) ? defaults.apiBaseUrl : (expoExtra.apiBaseUrl as string),
    apiKey: isEmpty(expoExtra.apiKey) ? defaults.apiKey : (expoExtra.apiKey as string),
    envName: currentEnv,
    debugEnabled: parseBoolean(expoExtra.debugEnabled, defaults.debugEnabled),
    analyticsEnabled: parseBoolean(expoExtra.analyticsEnabled, defaults.analyticsEnabled),
    sentryDsn: expoExtra.sentryDsn || defaults.sentryDsn,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loaded environment configuration
 *
 * This is evaluated once at module load time.
 * All values are resolved from environment variables with fallbacks.
 */
export const env: Environment = loadEnvironment();

/**
 * Check if running in development mode
 */
export const isDev: boolean = env.envName === 'development';

/**
 * Check if running in production mode
 */
export const isProd: boolean = env.envName === 'production';

/**
 * Check if running in staging mode
 */
export const isStaging: boolean = env.envName === 'staging';

/**
 * Validate that required environment variables are set
 * Call this at app startup for production builds
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  if (!env.apiBaseUrl) {
    errors.push('API_BASE_URL is not configured');
  }

  if (!env.apiKey && !isDev) {
    errors.push('API_KEY is not configured for non-development environment');
  }

  if (errors.length > 0) {
    const message = `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    if (__DEV__) {
      console.warn(message);
    } else {
      throw new Error(message);
    }
  }
}
