/**
 * Validation Types (T5.x)
 * 
 * Types for AI output validation, repair, and fallback handling.
 */

import { ContextPack } from './enrichment';

/**
 * Type of validation error
 */
export type ValidationErrorType = 'schema' | 'geometry' | 'integrity' | 'bounds';

/**
 * Individual validation error with path and context
 */
export interface ValidationError {
  /** Type of validation that failed */
  type: ValidationErrorType;
  /** JSON path to the error location (e.g., "zones[0].polygon[2]") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** The actual value that caused the error */
  value?: unknown;
}

/**
 * Result from a single validator
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
}

/**
 * Combined validation result from all validators
 */
export interface CombinedValidationResult {
  /** Whether all validations passed */
  valid: boolean;
  /** Parsed JSON result (null if parsing failed) */
  parsedResult: unknown | null;
  /** All validation errors from all validators */
  errors: ValidationError[];
  /** The raw response string from AI */
  rawResponse: string;
}

/**
 * Result from repair attempt
 */
export interface RepairResult {
  /** Whether the repair was successful */
  success: boolean;
  /** The repaired result (null if repair failed) */
  result: unknown | null;
  /** Any remaining validation errors after repair */
  errors: ValidationError[];
  /** Whether a repair was actually attempted */
  repairAttempted: boolean;
}

/**
 * Result from fallback assembly
 */
export interface FallbackResult {
  /** The fallback result with text-only content */
  result: {
    mode: 'general' | 'specific';
    zones: [];
    tactics: Array<{
      zone_id: string;
      recommended_rig: string;
      target_depth: string;
      retrieve_style: string;
      why_this_zone_works: string[];
    }>;
    plan_summary: string[];
    conditions_summary?: string[];
  };
  /** Always text_only for fallbacks */
  renderingMode: 'text_only';
  /** Always degraded for fallbacks */
  status: 'degraded';
}

/**
 * Configuration for validation
 */
export interface ValidationConfig {
  /** Maximum number of zones allowed (default: 3, env: MAX_ZONES) */
  maxZones: number;
  /** Minimum number of zones required (default: 1) */
  minZones: number;
  /** Strict mode fails on any warning (default: false) */
  strictMode: boolean;
}

/**
 * Context for repair operations
 */
export interface RepairContext {
  /** Original result that failed validation */
  originalResult: unknown;
  /** Validation errors to fix */
  errors: ValidationError[];
  /** Images for context */
  images: Buffer[];
  /** Context pack with all enrichment data */
  contextPack: ContextPack;
}
