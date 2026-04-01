/**
 * LangChain Structured Output Parsers
 *
 * Provides Zod schemas for validating CastSense AI output and domain-level
 * geometry/integrity checks used alongside model.withStructuredOutput().
 */

import { z } from 'zod';

// ============================================================================
// Validation Types (formerly from validation.ts)
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
// Zod Schema (converted from result.schema.json)
// ============================================================================

/**
 * Point coordinate as [x, y] array with normalized values (0-1).
 * Using z.array() instead of z.tuple() so the generated JSON Schema includes
 * an "items" field — OpenAI structured output rejects tuple/prefixItems format.
 */
const NormalizedPointSchema = z.array(z.number().min(0).max(1)).min(2).max(2)
  .describe('Point as [x, y] normalized coordinate');

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
// Custom Geometry Validation
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
export function validateGeometry(result: CastSenseResult): ValidationError[] {
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
 * All exports are defined inline above.
 * Types: ValidationError, ValidationResult
 * Functions: validateCastSenseResult, parseCastSenseResult, getCastSenseParser
 * Schemas: All Zod schemas for CastSense result structure
 */
