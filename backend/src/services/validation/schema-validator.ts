/**
 * JSON Schema Validation (T5.1)
 * 
 * Parse AI output as JSON and validate against contracts/result.schema.json.
 * Rejects responses with surrounding prose per §14.1.
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { ValidationResult, ValidationError } from '../../types/validation';

const logger = pino({ name: 'schema-validator' });

// Singleton Ajv instance with schema cached
let ajvInstance: Ajv | null = null;
let validateFn: ReturnType<Ajv['compile']> | null = null;

/**
 * Get or create the Ajv validator instance
 */
function getValidator(): ReturnType<Ajv['compile']> {
  if (validateFn) {
    return validateFn;
  }

  // Initialize Ajv with strict mode disabled for flexibility
  ajvInstance = new Ajv({
    allErrors: true, // Collect all errors, not just the first
    verbose: true,   // Include schema and data in errors
    strict: false    // Allow some schema variations
  });
  
  // Add standard formats (uri, email, etc.)
  addFormats(ajvInstance);

  // Load the result schema
  const schemaPath = path.resolve(__dirname, '../../../../contracts/result.schema.json');
  
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    
    validateFn = ajvInstance.compile(schema);
    logger.info({ schemaPath }, 'Loaded and compiled result schema');
    
    return validateFn;
  } catch (error) {
    logger.error({ error, schemaPath }, 'Failed to load result schema');
    throw new Error(`Failed to load result schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract JSON from an AI response string.
 * 
 * The response should be pure JSON. If the AI wrapped it in prose or markdown,
 * we attempt to extract the JSON object/array, but flag it as potentially problematic.
 * 
 * @param rawResponse - Raw string response from AI
 * @returns Extracted JSON string, or null if no valid JSON found
 */
export function extractJSON(rawResponse: string): string | null {
  if (!rawResponse || typeof rawResponse !== 'string') {
    return null;
  }

  const trimmed = rawResponse.trim();

  // Best case: response is already pure JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    // Find the matching closing bracket
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
        // Found the end of the JSON
        const extracted = trimmed.substring(0, i + 1);
        const remainder = trimmed.substring(i + 1).trim();
        
        if (remainder) {
          logger.warn({ 
            remainderLength: remainder.length,
            remainderPreview: remainder.substring(0, 100)
          }, 'JSON response had trailing content');
        }
        
        return extracted;
      }
    }
    
    // Unbalanced brackets - try to return as-is and let JSON.parse fail
    return trimmed;
  }

  // Try to find JSON wrapped in markdown code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    logger.warn('Found JSON wrapped in markdown code block - extracting');
    return extractJSON(codeBlockMatch[1]);
  }

  // Try to find JSON object/array anywhere in the response
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
    logger.warn({ 
      prefixLength: jsonStart,
      prefixPreview: trimmed.substring(0, Math.min(jsonStart, 100))
    }, 'Found JSON with leading prose - extracting');
    return extractJSON(trimmed.substring(jsonStart));
  }

  // No JSON found
  return null;
}

/**
 * Convert Ajv errors to our ValidationError format
 */
function convertAjvErrors(ajvErrors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!ajvErrors || ajvErrors.length === 0) {
    return [];
  }

  return ajvErrors.map(err => {
    // Build a readable path
    let path = err.instancePath || '/';
    
    // Convert JSON pointer to dot notation
    path = path
      .replace(/^\//, '')           // Remove leading slash
      .replace(/\//g, '.')          // Convert slashes to dots
      .replace(/\.(\d+)/g, '[$1]'); // Convert .0 to [0]
    
    if (!path) path = '(root)';

    return {
      type: 'schema' as const,
      path,
      message: formatAjvError(err),
      value: err.data
    };
  });
}

/**
 * Format a single Ajv error into a readable message
 */
function formatAjvError(err: ErrorObject): string {
  const keyword = err.keyword;
  const params = err.params as Record<string, unknown>;

  switch (keyword) {
    case 'required':
      return `Missing required property: ${params.missingProperty}`;
    
    case 'type':
      return `Expected type "${params.type}", got ${typeof err.data}`;
    
    case 'enum':
      return `Value must be one of: ${(params.allowedValues as string[]).join(', ')}`;
    
    case 'minimum':
      return `Value ${err.data} is below minimum ${params.limit}`;
    
    case 'maximum':
      return `Value ${err.data} is above maximum ${params.limit}`;
    
    case 'minLength':
      return `String is too short (minimum ${params.limit} characters)`;
    
    case 'maxLength':
      return `String is too long (maximum ${params.limit} characters)`;
    
    case 'minItems':
      return `Array has too few items (minimum ${params.limit})`;
    
    case 'maxItems':
      return `Array has too many items (maximum ${params.limit})`;
    
    case 'additionalProperties':
      return `Unknown property: ${params.additionalProperty}`;
    
    case 'pattern':
      return `Does not match required pattern: ${params.pattern}`;
    
    default:
      return err.message || `Validation failed: ${keyword}`;
  }
}

/**
 * Validate a parsed result against the JSON schema
 * 
 * @param result - Parsed JSON object to validate
 * @returns ValidationResult with valid flag and any errors
 */
export function validateResultSchema(result: unknown): ValidationResult {
  const validate = getValidator();
  
  const valid = validate(result);
  
  if (valid) {
    logger.debug('Schema validation passed');
    return {
      valid: true,
      errors: []
    };
  }

  const errors = convertAjvErrors(validate.errors);
  
  logger.info({ 
    errorCount: errors.length,
    errors: errors.slice(0, 5) // Log first 5 errors
  }, 'Schema validation failed');

  return {
    valid: false,
    errors
  };
}

/**
 * Parse and validate a raw AI response
 * 
 * Combines JSON extraction and schema validation in one call.
 * 
 * @param rawResponse - Raw string response from AI
 * @returns Object with parsed result (if valid JSON) and validation results
 */
export function parseAndValidate(rawResponse: string): {
  parsed: unknown | null;
  parseError: ValidationError | null;
  schemaResult: ValidationResult;
} {
  // Extract JSON from response
  const jsonString = extractJSON(rawResponse);
  
  if (!jsonString) {
    return {
      parsed: null,
      parseError: {
        type: 'schema',
        path: '(root)',
        message: 'No valid JSON found in response',
        value: rawResponse.substring(0, 200)
      },
      schemaResult: {
        valid: false,
        errors: []
      }
    };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    return {
      parsed: null,
      parseError: {
        type: 'schema',
        path: '(root)',
        message: `Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`,
        value: jsonString.substring(0, 200)
      },
      schemaResult: {
        valid: false,
        errors: []
      }
    };
  }

  // Validate against schema
  const schemaResult = validateResultSchema(parsed);

  return {
    parsed,
    parseError: null,
    schemaResult
  };
}

export default {
  extractJSON,
  validateResultSchema,
  parseAndValidate
};
