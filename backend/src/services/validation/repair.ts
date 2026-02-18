/**
 * AI Result Repair (T5.4)
 * 
 * Single repair attempt for invalid AI results.
 * Passes exact validation errors to AI and requests minimal edits.
 */

import pino from 'pino';
import { ContextPack } from '../../types/enrichment';
import { RepairResult, ValidationError } from '../../types/validation';
import { callAI, createAIError } from '../ai/client';
import { validateAIResult } from './index';

const logger = pino({ name: 'validation-repair' });

/**
 * Default timeout for repair attempts (shorter than analysis)
 */
const REPAIR_TIMEOUT_MS = 8000;

/**
 * Build the repair prompt with original JSON and validation errors
 */
function buildRepairPrompt(
  originalJson: string,
  errors: ValidationError[],
  contextPack: ContextPack
): string {
  // Format errors into a clear numbered list
  const errorList = errors.map((err, i) => 
    `${i + 1}. Path: ${err.path}\n   Type: ${err.type}\n   Error: ${err.message}${
      err.value !== undefined ? `\n   Current value: ${JSON.stringify(err.value)}` : ''
    }`
  ).join('\n\n');

  return `# JSON Repair Request

You are repairing a CastSense fishing analysis result that failed validation.
Make MINIMAL edits to fix ONLY the listed errors. Do not change anything else.

## Validation Errors to Fix

${errorList}

## Context

- Mode: ${contextPack.mode}
- Target species: ${contextPack.target_species || 'general'}
- Location: ${contextPack.location.waterbody_name || 'Unknown waterbody'}

## Original JSON (with errors)

\`\`\`json
${originalJson}
\`\`\`

## Rules for Repair

1. Fix ONLY the errors listed above
2. Make minimal changes - preserve all other values
3. Ensure all coordinates are normalized [0, 1]
4. Ensure all confidence scores are in [0, 1]
5. Ensure all zone_ids in tactics match actual zones
6. Ensure polygons have at least 3 points
7. Return ONLY the corrected JSON, no explanation

## Output

Return ONLY the corrected JSON object. Do not include any explanation, markdown code fences, or other text.`;
}

/**
 * Format errors for logging (abbreviated)
 */
function formatErrorsForLog(errors: ValidationError[]): string[] {
  return errors.slice(0, 5).map(e => `${e.type}:${e.path}: ${e.message.substring(0, 50)}`);
}

/**
 * Attempt to repair an invalid AI result
 * 
 * Makes ONE repair attempt by calling the AI with:
 * - The original invalid JSON
 * - The exact validation errors
 * - A request for minimal edits
 * 
 * @param originalResult - The original parsed result that failed validation
 * @param errors - List of validation errors to fix
 * @param images - Image buffers for context
 * @param contextPack - Context pack with enrichment data
 * @returns RepairResult with success status and repaired result
 */
export async function attemptRepair(
  originalResult: unknown,
  errors: ValidationError[],
  images: Buffer[],
  contextPack: ContextPack
): Promise<RepairResult> {
  // Don't attempt repair if there are no errors
  if (errors.length === 0) {
    logger.debug('No errors to repair');
    return {
      success: true,
      result: originalResult,
      errors: [],
      repairAttempted: false
    };
  }

  const startTime = Date.now();

  logger.info({
    errorCount: errors.length,
    errorTypes: [...new Set(errors.map(e => e.type))],
    errorSummary: formatErrorsForLog(errors)
  }, 'Attempting AI repair');

  // Serialize the original result
  let originalJson: string;
  try {
    originalJson = JSON.stringify(originalResult, null, 2);
  } catch (e) {
    logger.error({ error: e }, 'Failed to serialize original result for repair');
    return {
      success: false,
      result: null,
      errors,
      repairAttempted: false
    };
  }

  // Build repair prompt
  const prompt = buildRepairPrompt(originalJson, errors, contextPack);

  try {
    // Call AI for repair
    const response = await callAI(prompt, images, {
      timeout_ms: REPAIR_TIMEOUT_MS
    });

    const duration = Date.now() - startTime;

    // Validate the repaired result
    const validation = validateAIResult(response.content);

    if (validation.valid) {
      logger.info({
        duration,
        model: response.model
      }, 'Repair successful');

      return {
        success: true,
        result: validation.parsedResult,
        errors: [],
        repairAttempted: true
      };
    }

    // Repair didn't fully fix the issues
    logger.warn({
      duration,
      originalErrorCount: errors.length,
      remainingErrorCount: validation.errors.length,
      remainingErrors: formatErrorsForLog(validation.errors)
    }, 'Repair attempt did not fix all errors');

    return {
      success: false,
      result: validation.parsedResult,
      errors: validation.errors,
      repairAttempted: true
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({
      error,
      duration
    }, 'Repair attempt failed with error');

    return {
      success: false,
      result: null,
      errors,
      repairAttempted: true
    };
  }
}

export default {
  attemptRepair
};
