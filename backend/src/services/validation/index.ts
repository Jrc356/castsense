/**
 * Validation Pipeline (T5.3)
 * 
 * Combines all validators into a single validation pipeline.
 * Exports the main validateAIResult function.
 */

import pino from 'pino';
import {
  CombinedValidationResult,
  ValidationError,
  ValidationResult
} from '../../types/validation';
import { extractJSON, validateResultSchema, parseAndValidate } from './schema-validator';
import { validateGeometry, getValidationConfig } from './geometry-validator';
import { validateReferentialIntegrity } from './integrity-validator';

const logger = pino({ name: 'validation-pipeline' });

export { extractJSON, validateResultSchema } from './schema-validator';
export { validateGeometry, getValidationConfig } from './geometry-validator';
export { validateReferentialIntegrity } from './integrity-validator';

/**
 * Run all validators on an already-parsed result
 * 
 * @param result - Parsed JSON result object
 * @returns Combined validation result with all errors
 */
export function validateParsedResult(result: unknown): ValidationResult {
  const allErrors: ValidationError[] = [];

  // Run schema validation
  const schemaResult = validateResultSchema(result);
  allErrors.push(...schemaResult.errors);

  // Run geometry validation (even if schema failed - get complete error list)
  const geometryResult = validateGeometry(result);
  allErrors.push(...geometryResult.errors);

  // Run referential integrity validation
  const integrityResult = validateReferentialIntegrity(result);
  allErrors.push(...integrityResult.errors);

  const valid = schemaResult.valid && geometryResult.valid && integrityResult.valid;

  return {
    valid,
    errors: allErrors
  };
}

/**
 * Complete validation pipeline for AI result
 * 
 * This is the main entry point for validation. It:
 * 1. Extracts JSON from the raw response
 * 2. Parses the JSON
 * 3. Validates against the JSON schema
 * 4. Validates geometry/bounds constraints
 * 5. Validates referential integrity
 * 
 * @param rawResponse - Raw string response from AI
 * @returns CombinedValidationResult with parsed result and all errors
 */
export function validateAIResult(rawResponse: string): CombinedValidationResult {
  const startTime = Date.now();
  const allErrors: ValidationError[] = [];

  logger.info({ 
    responseLength: rawResponse.length 
  }, 'Starting validation pipeline');

  // Step 1: Extract and parse JSON
  const { parsed, parseError, schemaResult } = parseAndValidate(rawResponse);

  // If parsing failed, return early with parse error
  if (parseError) {
    logger.warn({ 
      parseError,
      duration: Date.now() - startTime
    }, 'Validation failed at JSON parsing');

    return {
      valid: false,
      parsedResult: null,
      errors: [parseError],
      rawResponse
    };
  }

  // Add schema errors
  allErrors.push(...schemaResult.errors);

  // Step 2: Run geometry validation
  const geometryResult = validateGeometry(parsed);
  allErrors.push(...geometryResult.errors);

  // Step 3: Run referential integrity validation
  const integrityResult = validateReferentialIntegrity(parsed);
  allErrors.push(...integrityResult.errors);

  // Determine overall validity
  const valid = schemaResult.valid && geometryResult.valid && integrityResult.valid;

  const duration = Date.now() - startTime;

  if (valid) {
    logger.info({ 
      duration,
      zoneCount: Array.isArray((parsed as Record<string, unknown>).zones) 
        ? ((parsed as Record<string, unknown>).zones as unknown[]).length 
        : 0
    }, 'Validation passed');
  } else {
    logger.info({
      duration,
      errorCount: allErrors.length,
      schemaErrors: schemaResult.errors.length,
      geometryErrors: geometryResult.errors.length,
      integrityErrors: integrityResult.errors.length
    }, 'Validation failed');
  }

  return {
    valid,
    parsedResult: parsed,
    errors: allErrors,
    rawResponse
  };
}

/**
 * Quick check if a result would pass validation (for repair verification)
 * 
 * @param result - Parsed JSON result object
 * @returns True if all validations pass
 */
export function isValidResult(result: unknown): boolean {
  const validation = validateParsedResult(result);
  return validation.valid;
}

export default {
  validateAIResult,
  validateParsedResult,
  isValidResult,
  extractJSON,
  validateResultSchema,
  validateGeometry,
  validateReferentialIntegrity,
  getValidationConfig
};
