/**
 * CastSense Backend Configuration
 *
 * Centralized configuration management with:
 * - Type-safe configuration loading
 * - Startup validation with clear error messages
 * - Singleton pattern for cached config access
 *
 * Usage:
 *   import { loadConfig, getConfig } from './config';
 *
 *   // At startup (will throw on validation errors)
 *   loadConfig();
 *
 *   // Anywhere else
 *   const config = getConfig();
 */

import { Config, parseConfig, ConfigValidationError } from './schema';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Config Cache
// ─────────────────────────────────────────────────────────────────────────────

let cachedConfig: Config | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load and validate configuration from environment variables.
 *
 * Call this at application startup. Will throw with detailed error messages
 * if required environment variables are missing or invalid.
 *
 * @returns Validated configuration object
 * @throws Error if configuration is invalid
 */
export function loadConfig(): Config {
  try {
    cachedConfig = parseConfig(process.env);
    return cachedConfig;
  } catch (error) {
    // Re-throw with clear formatting for startup failures
    if (error instanceof Error) {
      console.error('\n╔══════════════════════════════════════════════════════════════════╗');
      console.error('║                    CONFIGURATION ERROR                           ║');
      console.error('╚══════════════════════════════════════════════════════════════════╝\n');
      console.error(error.message);
      console.error('\n');
    }
    throw error;
  }
}

/**
 * Get the cached configuration.
 *
 * Must call loadConfig() before using this function.
 *
 * @returns Cached configuration object
 * @throws Error if loadConfig() has not been called
 */
export function getConfig(): Config {
  if (!cachedConfig) {
    throw new Error(
      'Configuration not loaded. Call loadConfig() at application startup before accessing config.'
    );
  }
  return cachedConfig;
}

/**
 * Reset the cached configuration.
 * Primarily used for testing.
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Check if configuration has been loaded.
 */
export function isConfigLoaded(): boolean {
  return cachedConfig !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────────

export type { Config } from './schema';
export { ConfigValidationError } from './schema';
