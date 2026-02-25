/**
 * Validation Service (Mobile)
 * 
 * Validates AI output against result.schema.json using AJV.
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

// Import the schema directly
import resultSchema from '../schemas/result.schema.json';
import responseSchema from '../schemas/response.schema.json';

// ============================================================================
// Types
// ============================================================================

export interface ValidationError {
  type: 'parse' | 'schema' | 'geometry' | 'integrity';
  message: string;
  path?: string;
  details?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  parsed?: unknown;
}

// ============================================================================
// AJV Setup
// ============================================================================

let ajvInstance: Ajv | null = null;
let resultValidator: ReturnType<Ajv['compile']> | null = null;
let responseValidator: ReturnType<Ajv['compile']> | null = null;

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });
    addFormats(ajvInstance);
  }
  return ajvInstance;
}

function getResultValidator(): ReturnType<Ajv['compile']> {
  if (!resultValidator) {
    const ajv = getAjv();
    resultValidator = ajv.compile(resultSchema);
  }
  return resultValidator;
}

function getResponseValidator(): ReturnType<Ajv['compile']> {
  if (!responseValidator) {
    const ajv = getAjv();
    responseValidator = ajv.compile(responseSchema);
  }
  return responseValidator;
}

// ============================================================================
// JSON Extraction
// ============================================================================

/**
 * Extract JSON from AI response string
 * Handles pure JSON, markdown code blocks, and JSON wrapped in prose
 */
function extractJSON(rawResponse: string): string | null {
  if (!rawResponse || typeof rawResponse !== 'string') {
    return null;
  }

  const trimmed = rawResponse.trim();

  // Best case: pure JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const isObject = trimmed.startsWith('{');
    const openBracket = isObject ? '{' : '[';
    const closeBracket = isObject ? '}' : ']';

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === openBracket) depth++;
      if (char === closeBracket) depth--;

      if (depth === 0) {
        return trimmed.substring(0, i + 1);
      }
    }

    return trimmed;
  }

  // Try markdown code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    console.warn('[Validation] Found JSON wrapped in markdown code block');
    return extractJSON(codeBlockMatch[1]);
  }

  // Try to find JSON anywhere in response
  const jsonStartObj = trimmed.indexOf('{');
  const jsonStartArr = trimmed.indexOf('[');

  let jsonStart = -1;
  if (jsonStartObj >= 0 && jsonStartArr >= 0) {
    jsonStart = Math.min(jsonStartObj, jsonStartArr);
  } else if (jsonStartObj >= 0) {
    jsonStart = jsonStartObj;
  } else if (jsonStartArr >= 0) {
    jsonStart = jsonStartArr;
  }

  if (jsonStart > 0) {
    console.warn('[Validation] Found JSON with leading prose');
    return extractJSON(trimmed.substring(jsonStart));
  }

  return null;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Convert AJV errors to ValidationError format
 */
function convertAjvErrors(errors: ErrorObject[]): ValidationError[] {
  return errors.map((err) => ({
    type: 'schema',
    message: err.message || 'Schema validation error',
    path: err.instancePath || err.schemaPath,
    details: {
      keyword: err.keyword,
      params: err.params,
      data: err.data
    }
  }));
}

/**
 * Validate AI result output
 * 
 * @param rawResponse - Raw string response from OpenAI
 * @returns Validation result with parsed data and errors
 */
export function validateAIResult(rawResponse: string): ValidationResult {
  const errors: ValidationError[] = [];

  // Step 1: Extract JSON
  const jsonString = extractJSON(rawResponse);
  if (!jsonString) {
    return {
      valid: false,
      errors: [{
        type: 'parse',
        message: 'No valid JSON found in response'
      }]
    };
  }

  // Step 2: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        type: 'parse',
        message: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }

  // Step 3: Validate against schema
  const validator = getResultValidator();
  const schemaValid = validator(parsed);

  if (!schemaValid && validator.errors) {
    errors.push(...convertAjvErrors(validator.errors));
  }

  // Step 4: Basic geometry validation (zones within bounds)
  if (parsed && typeof parsed === 'object' && 'zones' in parsed) {
    const result = parsed as { 
      zones?: Array<{ 
        polygon?: Array<{ x: number; y: number }>;
        cast_arrow?: { start: { x: number; y: number }; end: { x: number; y: number } };
      }>;
      analysis_frame?: { width_px?: number; height_px?: number };
    };

    const zones = result.zones || [];
    const frame = result.analysis_frame;

    if (frame?.width_px && frame?.height_px) {
      zones.forEach((zone, idx) => {
        // Check polygon bounds
        zone.polygon?.forEach((point, pointIdx) => {
          if (point.x < 0 || point.x > frame.width_px! || 
              point.y < 0 || point.y > frame.height_px!) {
            errors.push({
              type: 'geometry',
              message: `Zone ${idx} polygon point ${pointIdx} out of bounds`,
              details: { point, frame }
            });
          }
        });

        // Check arrow bounds
        if (zone.cast_arrow) {
          const { start, end } = zone.cast_arrow;
          if (start.x < 0 || start.x > frame.width_px! || 
              start.y < 0 || start.y > frame.height_px! ||
              end.x < 0 || end.x > frame.width_px! ||
              end.y < 0 || end.y > frame.height_px!) {
            errors.push({
              type: 'geometry',
              message: `Zone ${idx} arrow out of bounds`,
              details: { start, end, frame }
            });
          }
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed
  };
}

/**
 * Validate response envelope
 * 
 * @param data - Parsed response data
 * @returns Validation result
 */
export function validateResponse(data: unknown): ValidationResult {
  const validator = getResponseValidator();
  const valid = validator(data);

  if (!valid && validator.errors) {
    return {
      valid: false,
      errors: convertAjvErrors(validator.errors)
    };
  }

  return {
    valid: true,
    errors: []
  };
}

/**
 * Quick check if result has valid structure (no full validation)
 */
export function hasValidStructure(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;

  const r = result as { 
    mode?: unknown; 
    zones?: unknown; 
    tactics?: unknown;
  };

  return (
    typeof r.mode === 'string' &&
    Array.isArray(r.zones) &&
    Array.isArray(r.tactics)
  );
}
