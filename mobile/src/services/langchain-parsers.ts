/**
 * LangChain Structured Output Parsers (Mobile)
 * 
 * Validates AI output using LangChain's StructuredOutputParser with Zod schemas.
 * Replaces AJV-based validation while preserving ValidationResult interface.
 */

import { z } from 'zod';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import type { ValidationError, ValidationResult } from './validation';

// ============================================================================
// Zod Schema (converted from result.schema.json)
// ============================================================================

/**
 * Point coordinate as [x, y] array with normalized values (0-1)
 */
const NormalizedPointSchema = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1)
]).describe('Point as [x, y] normalized coordinate');

/**
 * Likely species with confidence
 */
const SpeciesConfidenceSchema = z.object({
  species: z.string().min(1).max(64).describe('Species name'),
  confidence: z.number().min(0).max(1).describe('Confidence score (0-1)')
});

/**
 * Analysis frame metadata
 */
const AnalysisFrameSchema = z.object({
  type: z.enum(['photo', 'video_frame']).describe('Type of analysis frame'),
  width_px: z.number().int().min(1).describe('Frame width in pixels'),
  height_px: z.number().int().min(1).describe('Frame height in pixels'),
  selected_frame_index: z.number().int().min(0).optional()
    .describe('For video: index of selected keyframe'),
  frame_timestamp_ms: z.number().int().min(0).optional()
    .describe('For video: timestamp of frame in milliseconds')
});

/**
 * Zone style hints
 */
const ZoneStyleSchema = z.object({
  priority: z.number().int().min(1).max(10).optional()
    .describe('Priority for rendering order (1 = highest)'),
  hint: z.enum(['cover', 'structure', 'current', 'depth_edge', 'shade', 'inflow', 'unknown']).optional()
    .describe('Type of fishing structure/feature')
}).strict();

/**
 * Cast arrow
 */
const CastArrowSchema = z.object({
  start: NormalizedPointSchema.describe('Arrow start point [x, y]'),
  end: NormalizedPointSchema.describe('Arrow end point [x, y]')
}).strict();

/**
 * Zone definition
 */
const ZoneSchema = z.object({
  zone_id: z.string().min(1).max(8).describe('Unique zone identifier'),
  label: z.string().describe('Zone label (Primary, Secondary, Tertiary, or custom)'),
  confidence: z.number().min(0).max(1).describe('Zone confidence score (0-1)'),
  target_species: z.string().describe('Target species for this zone'),
  polygon: z.array(NormalizedPointSchema).min(3)
    .describe('Zone boundary as array of [x,y] normalized coordinates'),
  cast_arrow: CastArrowSchema.describe('Cast direction arrow'),
  retrieve_path: z.array(NormalizedPointSchema).optional()
    .describe('Optional retrieve path as polyline'),
  style: ZoneStyleSchema.optional().describe('Rendering style hints')
}).strict();

/**
 * Tactics for a zone
 */
const TacticsSchema = z.object({
  zone_id: z.string().describe('Zone this tactic applies to'),
  recommended_rig: z.string().describe('Recommended lure/rig setup'),
  alternate_rigs: z.array(z.string()).optional().describe('Alternative rig options'),
  target_depth: z.string().describe('Recommended target depth'),
  retrieve_style: z.string().describe('How to retrieve the lure'),
  cadence: z.string().optional().describe('Retrieve cadence description'),
  cast_count_suggestion: z.string().optional().describe('Suggested number of casts'),
  why_this_zone_works: z.array(z.string()).min(1)
    .describe('Reasons this zone is productive'),
  steps: z.array(z.string()).optional().describe('Step-by-step fishing instructions')
}).strict();

/**
 * Explainability metadata
 */
const ExplainabilitySchema = z.object({
  scene_observations: z.array(z.string()).optional()
    .describe('What the AI observed in the scene'),
  assumptions: z.array(z.string()).optional()
    .describe('Assumptions made during analysis')
}).strict();

/**
 * Complete CastSense result schema
 */
export const CastSenseResultSchema = z.object({
  mode: z.enum(['general', 'specific']).describe('Analysis mode used'),
  likely_species: z.array(SpeciesConfidenceSchema).optional()
    .describe('Likely species with confidence scores'),
  analysis_frame: AnalysisFrameSchema.optional()
    .describe('Reference frame for overlay coordinates'),
  zones: z.array(ZoneSchema).min(0).max(10).describe('Cast zones with overlay data'),
  tactics: z.array(TacticsSchema).describe('Tactics for each zone'),
  conditions_summary: z.array(z.string()).optional()
    .describe('Summary of current conditions'),
  plan_summary: z.array(z.string()).optional()
    .describe('Overall fishing plan summary'),
  explainability: ExplainabilitySchema.optional()
    .describe('AI reasoning transparency')
}).strict();

/**
 * Inferred TypeScript type from Zod schema
 */
export type CastSenseResult = z.infer<typeof CastSenseResultSchema>;

// ============================================================================
// Parser Setup
// ============================================================================

let parser: StructuredOutputParser<any> | null = null;

/**
 * Get or create the structured output parser
 */
function getParser(): StructuredOutputParser<any> {
  if (!parser) {
    parser = StructuredOutputParser.fromZodSchema(CastSenseResultSchema);
  }
  return parser;
}

/**
 * Get format instructions for the AI prompt
 * Use this in your prompt templates to instruct the AI on output format
 * 
 * @example
 * const instructions = getFormatInstructions();
 * const prompt = `Analyze this fishing spot.\n\n${instructions}`;
 */
export function getFormatInstructions(): string {
  const p = getParser();
  return p.getFormatInstructions();
}

// ============================================================================
// JSON Extraction (preserved from validation.ts)
// ============================================================================

/**
 * Extract JSON from AI response string
 * Handles pure JSON, markdown code blocks, and JSON wrapped in prose
 * 
 * NOTE: This is preserved from the original validation.ts for compatibility.
 * LangChain's OutputFixingParser can handle this, but we keep the existing
 * logic for now to maintain behavior consistency.
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
    console.warn('[LangChain Parser] Found JSON wrapped in markdown code block');
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
    console.warn('[LangChain Parser] Found JSON with leading prose');
    return extractJSON(trimmed.substring(jsonStart));
  }

  return null;
}

// ============================================================================
// Zod Error Formatting
// ============================================================================

/**
 * Convert Zod validation errors to ValidationError format
 */
function formatZodErrors(zodError: z.ZodError): ValidationError[] {
  return zodError.issues.map(issue => ({
    type: 'schema' as const,
    message: issue.message,
    path: issue.path.join('.'),
    details: {
      code: issue.code,
      expected: 'expected' in issue ? issue.expected : undefined,
      received: 'received' in issue ? issue.received : undefined
    }
  }));
}

// ============================================================================
// Custom Geometry Validation (preserved from validation.ts)
// ============================================================================

/**
 * Perform custom geometry validation on parsed result
 * 
 * NOTE: LangChain/Zod validates schema compliance, but not domain-specific
 * geometry constraints. This function preserves the original logic from
 * validation.ts for checking polygon bounds, zone consistency, etc.
 * 
 * @param result - Parsed and schema-valid result
 * @returns Array of geometry validation errors
 */
function validateGeometry(result: CastSenseResult): ValidationError[] {
  const errors: ValidationError[] = [];
  const zones = result.zones || [];
  const frame = result.analysis_frame;

  // Only validate bounds if frame dimensions are provided
  if (frame?.width_px && frame?.height_px) {
    zones.forEach((zone, idx) => {
      // Check polygon bounds
      // NOTE: Schema defines normalized coords (0-1), but original validation
      // checks against pixel dimensions. Preserving original logic here.
      zone.polygon?.forEach((point, pointIdx) => {
        const [x, y] = point;
        if (x < 0 || x > 1 || y < 0 || y > 1) {
          errors.push({
            type: 'geometry',
            message: `Zone ${idx} polygon point ${pointIdx} out of normalized bounds [0,1]`,
            details: { point, bounds: [0, 1] }
          });
        }
      });

      // Check arrow bounds
      if (zone.cast_arrow) {
        const { start, end } = zone.cast_arrow;
        const [startX, startY] = start;
        const [endX, endY] = end;

        if (startX < 0 || startX > 1 || startY < 0 || startY > 1 ||
            endX < 0 || endX > 1 || endY < 0 || endY > 1) {
          errors.push({
            type: 'geometry',
            message: `Zone ${idx} arrow out of normalized bounds [0,1]`,
            details: { start, end, bounds: [0, 1] }
          });
        }
      }

      // Check retrieve path if present
      if (zone.retrieve_path) {
        zone.retrieve_path.forEach((point, pointIdx) => {
          const [x, y] = point;
          if (x < 0 || x > 1 || y < 0 || y > 1) {
            errors.push({
              type: 'geometry',
              message: `Zone ${idx} retrieve path point ${pointIdx} out of normalized bounds [0,1]`,
              details: { point, bounds: [0, 1] }
            });
          }
        });
      }
    });
  }

  // Validate zone-tactics consistency
  const zoneIds = new Set(zones.map(z => z.zone_id));
  const tacticZoneIds = new Set(result.tactics.map(t => t.zone_id));

  result.tactics.forEach((tactic, idx) => {
    if (!zoneIds.has(tactic.zone_id)) {
      errors.push({
        type: 'integrity',
        message: `Tactic ${idx} references non-existent zone_id: ${tactic.zone_id}`,
        details: { tactic, availableZones: Array.from(zoneIds) }
      });
    }
  });

  // Warn if zones exist without tactics (not an error, but noteworthy)
  zones.forEach(zone => {
    if (!tacticZoneIds.has(zone.zone_id)) {
      console.warn(`[LangChain Parser] Zone ${zone.zone_id} has no corresponding tactics`);
    }
  });

  return errors;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Parse and validate AI result using LangChain StructuredOutputParser
 * 
 * This is the main validation function that replaces `validateAIResult` from
 * validation.ts. It uses Zod schema validation via LangChain instead of AJV.
 * Includes error recovery: if structured parser fails, tries manual JSON extraction + Zod validation.
 * 
 * @param rawResponse - Raw string response from AI model
 * @returns ValidationResult with parsed data and errors (compatible with existing code)
 * 
 * @example
 * const result = await parseAIResult(aiResponse);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * } else {
 *   const data = result.parsed as CastSenseResult;
 *   // Use validated data
 * }
 */
export async function parseAIResult(rawResponse: string): Promise<ValidationResult> {
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

  // Step 2: Try LangChain StructuredOutputParser first
  const p = getParser();
  let parsed: CastSenseResult;

  try {
    parsed = await p.parse(jsonString) as CastSenseResult;
  } catch (parseError) {
    // Error recovery: try fallback to manual JSON parsing + Zod validation
    console.warn('[LangChain Parser] Structured parse failed, trying fallback', parseError);
    
    // Parse JSON manually
    let jsonData: unknown;
    try {
      jsonData = JSON.parse(jsonString);
    } catch (jsonError) {
      console.error('[LangChain Parser] Both structured and manual JSON parse failed');
      return {
        valid: false,
        errors: [{
          type: 'parse',
          message: `JSON parse error: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`,
          details: { structuredError: parseError, jsonError }
        }]
      };
    }

    // Validate with Zod schema directly
    const zodResult = CastSenseResultSchema.safeParse(jsonData);
    if (!zodResult.success) {
      console.error('[LangChain Parser] Both structured and fallback validation failed');
      return {
        valid: false,
        errors: formatZodErrors(zodResult.error)
      };
    }

    // Fallback succeeded
    console.log('[LangChain Parser] Fallback validation succeeded');
    parsed = zodResult.data;
  }

  // Step 3: Custom geometry validation
  const geometryErrors = validateGeometry(parsed);
  errors.push(...geometryErrors);

  return {
    valid: errors.length === 0,
    errors,
    parsed
  };
}

/**
 * Synchronous version of parseAIResult for backward compatibility
 * 
 * NOTE: LangChain's parser is async, but we can make it appear synchronous
 * for simple cases. This is provided for drop-in replacement of the old
 * validateAIResult function. Includes error recovery with manual JSON parsing.
 * 
 * @param rawResponse - Raw string response from AI model
 * @returns ValidationResult (throws if async parsing is required)
 */
export function parseAIResultSync(rawResponse: string): ValidationResult {
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

  // Step 2: Parse JSON manually first
  let jsonData: unknown;
  try {
    jsonData = JSON.parse(jsonString);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        type: 'parse',
        message: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }

  // Step 3: Validate with Zod schema
  const result = CastSenseResultSchema.safeParse(jsonData);
  
  if (!result.success) {
    // Convert Zod errors using helper
    return {
      valid: false,
      errors: formatZodErrors(result.error)
    };
  }

  // Step 4: Custom geometry validation
  const geometryErrors = validateGeometry(result.data);
  errors.push(...geometryErrors);

  return {
    valid: errors.length === 0,
    errors,
    parsed: result.data
  };
}

/**
 * Quick check if result has valid structure (no full validation)
 * Compatible with hasValidStructure from validation.ts
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

// ============================================================================
// Exports
// ============================================================================

/**
 * Re-export types from validation.ts for convenience
 */
export type { ValidationError, ValidationResult } from './validation';
