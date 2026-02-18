/**
 * Configuration Schema Validation
 *
 * Type-safe validation for all environment variables.
 * Uses plain TypeScript validation for minimal dependencies.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Config {
  // Server
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: string;
  corsOrigin: string;
  buildVersion: string;

  // Authentication
  apiKey: string | null;

  // AI Provider (Required)
  aiProviderApiKey: string;
  aiProviderBaseUrl: string | null;
  aiModel: string;
  aiTwoStageEnabled: boolean;

  // Enrichment APIs (Optional for some providers)
  weatherApiKey: string | null;
  geocodeApiKey: string | null;

  // Object Storage (Optional)
  objectStoreBucket: string | null;
  objectStoreRegion: string | null;

  // Media Processing
  mediaTtlSeconds: number;
  maxPhotoBytes: number;
  maxVideoBytes: number;
  maxImageDimension: number;
  keyframeMaxDimension: number;

  // Timeouts (milliseconds)
  enrichmentTimeoutMs: number;
  aiTimeoutMsPhoto: number;
  aiTimeoutMsVideo: number;
  backendTimeoutMs: number;

  // Rate Limiting
  rateLimitRpm: number;
  rateLimitConcurrency: number;

  // Privacy
  logLocationEnabled: boolean;

  // Hydrology (Optional)
  hydrologyApiKey: string | null;
  hydrologyApiUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

export class ConfigValidationError extends Error {
  constructor(
    public field: string,
    public reason: string
  ) {
    super(`Config validation failed for ${field}: ${reason}`);
    this.name = 'ConfigValidationError';
  }
}

export function requireString(
  value: string | undefined,
  field: string
): string {
  if (!value || value.trim() === '') {
    throw new ConfigValidationError(field, 'Required environment variable is missing or empty');
  }
  return value.trim();
}

export function optionalString(
  value: string | undefined
): string | null {
  if (!value || value.trim() === '') {
    return null;
  }
  return value.trim();
}

export function requireInt(
  value: string | undefined,
  field: string,
  options?: { min?: number; max?: number; default?: number }
): number {
  const { min, max, default: defaultValue } = options ?? {};

  if (!value || value.trim() === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new ConfigValidationError(field, 'Required environment variable is missing');
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new ConfigValidationError(field, `Invalid integer value: "${value}"`);
  }

  if (min !== undefined && parsed < min) {
    throw new ConfigValidationError(field, `Value ${parsed} is less than minimum ${min}`);
  }

  if (max !== undefined && parsed > max) {
    throw new ConfigValidationError(field, `Value ${parsed} is greater than maximum ${max}`);
  }

  return parsed;
}

export function requireBoolean(
  value: string | undefined,
  field: string,
  defaultValue: boolean = false
): boolean {
  if (!value || value.trim() === '') {
    return defaultValue;
  }

  const normalized = value.toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new ConfigValidationError(field, `Invalid boolean value: "${value}". Use true/false, 1/0, yes/no, or on/off`);
}

export function requireEnum<T extends string>(
  value: string | undefined,
  field: string,
  validValues: readonly T[],
  defaultValue?: T
): T {
  if (!value || value.trim() === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new ConfigValidationError(field, `Required environment variable is missing. Valid values: ${validValues.join(', ')}`);
  }

  const normalized = value.trim() as T;
  if (!validValues.includes(normalized)) {
    throw new ConfigValidationError(field, `Invalid value: "${value}". Valid values: ${validValues.join(', ')}`);
  }

  return normalized;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config Parser
// ─────────────────────────────────────────────────────────────────────────────

const NODE_ENVS = ['development', 'production', 'test'] as const;

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const errors: ConfigValidationError[] = [];

  const collect = <T>(fn: () => T, defaultValue?: T): T => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof ConfigValidationError) {
        errors.push(e);
        return defaultValue as T;
      }
      throw e;
    }
  };

  const config: Config = {
    // Server
    port: collect(() => requireInt(env.PORT, 'PORT', { default: 3000, min: 1, max: 65535 }), 3000),
    host: collect(() => optionalString(env.HOST) ?? '0.0.0.0', '0.0.0.0'),
    nodeEnv: collect(() => requireEnum(env.NODE_ENV, 'NODE_ENV', NODE_ENVS, 'development'), 'development'),
    logLevel: optionalString(env.LOG_LEVEL) ?? 'info',
    corsOrigin: optionalString(env.CORS_ORIGIN) ?? '*',
    buildVersion: optionalString(env.BUILD_VERSION) ?? 'dev',

    // Authentication
    apiKey: optionalString(env.API_KEY),

    // AI Provider
    aiProviderApiKey: collect(() => requireString(env.AI_PROVIDER_API_KEY, 'AI_PROVIDER_API_KEY'), ''),
    aiProviderBaseUrl: optionalString(env.AI_PROVIDER_BASE_URL),
    aiModel: optionalString(env.AI_MODEL) ?? 'gpt-4o',
    aiTwoStageEnabled: collect(() => requireBoolean(env.AI_TWO_STAGE_ENABLED, 'AI_TWO_STAGE_ENABLED', false), false),

    // Enrichment APIs
    weatherApiKey: optionalString(env.WEATHER_API_KEY),
    geocodeApiKey: optionalString(env.GEOCODE_API_KEY),

    // Object Storage
    objectStoreBucket: optionalString(env.OBJECT_STORE_BUCKET),
    objectStoreRegion: optionalString(env.OBJECT_STORE_REGION),

    // Media Processing
    mediaTtlSeconds: collect(() => requireInt(env.MEDIA_TTL_SECONDS, 'MEDIA_TTL_SECONDS', { default: 3600, min: 60 }), 3600),
    maxPhotoBytes: collect(() => requireInt(env.MAX_PHOTO_BYTES, 'MAX_PHOTO_BYTES', { default: 8388608, min: 1024 }), 8388608),
    maxVideoBytes: collect(() => requireInt(env.MAX_VIDEO_BYTES, 'MAX_VIDEO_BYTES', { default: 26214400, min: 1024 }), 26214400),
    maxImageDimension: collect(() => requireInt(env.MAX_IMAGE_DIMENSION, 'MAX_IMAGE_DIMENSION', { default: 1920, min: 100 }), 1920),
    keyframeMaxDimension: collect(() => requireInt(env.KEYFRAME_MAX_DIMENSION, 'KEYFRAME_MAX_DIMENSION', { default: 1280, min: 100 }), 1280),

    // Timeouts
    enrichmentTimeoutMs: collect(() => requireInt(env.ENRICHMENT_TIMEOUT_MS, 'ENRICHMENT_TIMEOUT_MS', { default: 2000, min: 100 }), 2000),
    aiTimeoutMsPhoto: collect(() => requireInt(env.AI_TIMEOUT_MS_PHOTO, 'AI_TIMEOUT_MS_PHOTO', { default: 12000, min: 1000 }), 12000),
    aiTimeoutMsVideo: collect(() => requireInt(env.AI_TIMEOUT_MS_VIDEO, 'AI_TIMEOUT_MS_VIDEO', { default: 18000, min: 1000 }), 18000),
    backendTimeoutMs: collect(() => requireInt(env.BACKEND_TIMEOUT_MS, 'BACKEND_TIMEOUT_MS', { default: 30000, min: 1000 }), 30000),

    // Rate Limiting
    rateLimitRpm: collect(() => requireInt(env.RATE_LIMIT_RPM, 'RATE_LIMIT_RPM', { default: 60, min: 1 }), 60),
    rateLimitConcurrency: collect(() => requireInt(env.RATE_LIMIT_CONCURRENCY, 'RATE_LIMIT_CONCURRENCY', { default: 10, min: 1 }), 10),

    // Privacy
    logLocationEnabled: collect(() => requireBoolean(env.LOG_LOCATION_ENABLED, 'LOG_LOCATION_ENABLED', false), false),

    // Hydrology
    hydrologyApiKey: optionalString(env.HYDROLOGY_API_KEY),
    hydrologyApiUrl: optionalString(env.HYDROLOGY_API_URL),
  };

  // Collect all errors and throw with detailed message
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `  - ${e.field}: ${e.reason}`).join('\n');
    throw new Error(
      `Configuration validation failed with ${errors.length} error(s):\n${errorMessages}\n\n` +
      `Ensure all required environment variables are set. See .env.example for reference.`
    );
  }

  return config;
}
