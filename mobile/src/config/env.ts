/**
 * CastSense Mobile Environment Configuration
 *
 * Type-safe environment loading with build-time injection support.
 * Uses react-native-config pattern for environment variable access.
 *
 * Environment variables are injected at build time via:
 * - .env files (react-native-config)
 * - Metro bundler configuration
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
// react-native-config Type Declaration
// ─────────────────────────────────────────────────────────────────────────────

// Type declaration for react-native-config
// Install: npm install react-native-config
// The actual Config object is injected at build time
interface RNConfig {
  API_BASE_URL?: string;
  API_KEY?: string;
  ENV_NAME?: string;
  DEBUG_ENABLED?: string;
  ANALYTICS_ENABLED?: string;
  SENTRY_DSN?: string;
}

// Try to import react-native-config, fallback to empty object
let Config: RNConfig = {};
try {
  // @ts-ignore - react-native-config may not be installed
  Config = require('react-native-config').default || {};
} catch {
  // react-native-config not available, use defaults
}

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
  // First check explicit ENV_NAME from config
  const envName = Config.ENV_NAME?.toLowerCase();
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
 * Parse a boolean-like environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Load environment configuration with proper fallbacks
 */
function loadEnvironment(): Environment {
  const currentEnv = detectEnvironment();
  const defaults = DEFAULTS[currentEnv];

  return {
    apiBaseUrl: Config.API_BASE_URL || defaults.apiBaseUrl,
    apiKey: Config.API_KEY || defaults.apiKey,
    envName: currentEnv,
    debugEnabled: parseBoolean(Config.DEBUG_ENABLED, defaults.debugEnabled),
    analyticsEnabled: parseBoolean(Config.ANALYTICS_ENABLED, defaults.analyticsEnabled),
    sentryDsn: Config.SENTRY_DSN || defaults.sentryDsn,
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
