/**
 * Tests for LangChain Structured Output Parsers
 *
 * Tests Zod schema validation and geometry/integrity checks used by
 * model.withStructuredOutput(CastSenseResultSchema).
 */

import {
  hasValidStructure,
  validateGeometry,
  CastSenseResultSchema,
  type CastSenseResult
} from '../services/langchain-parsers';

describe('LangChain Parsers', () => {
  // ============================================================================
  // Test Data
  // ============================================================================

  const validResult: CastSenseResult = {
    mode: 'general',
    likely_species: [
      { species: 'Largemouth Bass', confidence: 0.85 },
      { species: 'Smallmouth Bass', confidence: 0.65 }
    ],
    analysis_frame: {
      type: 'photo',
      width_px: 1920,
      height_px: 1080
    },
    zones: [
      {
        zone_id: 'Z1',
        label: 'Primary',
        confidence: 0.9,
        target_species: 'Largemouth Bass',
        polygon: [
          [0.1, 0.2],
          [0.3, 0.2],
          [0.3, 0.4],
          [0.1, 0.4]
        ],
        cast_arrow: {
          start: [0.2, 0.25],
          end: [0.25, 0.3]
        },
        style: {
          priority: 1,
          hint: 'structure'
        }
      }
    ],
    tactics: [
      {
        zone_id: 'Z1',
        recommended_rig: 'Texas-rigged soft plastic',
        alternate_rigs: ['Jig', 'Spinnerbait'],
        target_depth: '6-8 feet',
        retrieve_style: 'Slow drag with pauses',
        cadence: 'Drag, pause 3 seconds, repeat',
        cast_count_suggestion: '5-10 casts',
        why_this_zone_works: [
          'Visible structure provides cover',
          'Depth transition likely holds fish'
        ],
        steps: [
          'Cast beyond the structure',
          'Let it sink to bottom',
          'Slow drag towards you'
        ]
      }
    ],
    conditions_summary: [
      'Clear water visibility',
      'Moderate wind from west'
    ],
    plan_summary: [
      'Focus on structure near shore',
      'Work zones systematically'
    ],
    explainability: {
      scene_observations: [
        'Rocky shoreline visible',
        'Water appears clear'
      ],
      assumptions: [
        'Assuming post-spawn period based on season'
      ]
    }
  };

  // ============================================================================
  // Schema Tests
  // ============================================================================

  describe('CastSenseResultSchema', () => {
    it('should validate a complete valid result', () => {
      const result = CastSenseResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('general');
        expect(result.data.zones).toHaveLength(1);
      }
    });

    it('should require mode field', () => {
      const invalid = { ...validResult };
      delete (invalid as any).mode;
      const result = CastSenseResultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should require zones array', () => {
      const invalid = { ...validResult };
      delete (invalid as any).zones;
      const result = CastSenseResultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should require tactics array', () => {
      const invalid = { ...validResult };
      delete (invalid as any).tactics;
      const result = CastSenseResultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid mode values', () => {
      const invalid = { ...validResult, mode: 'invalid_mode' };
      const result = CastSenseResultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate normalized coordinates (0-1)', () => {
      const result = CastSenseResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should reject coordinates outside [0,1] range', () => {
      const invalid = {
        ...validResult,
        zones: [{
          ...validResult.zones[0],
          polygon: [[0.5, 0.5], [1.5, 0.5], [1.5, 0.8]] // 1.5 > 1
        }]
      };
      const result = CastSenseResultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should require minimum 3 polygon points', () => {
      const invalid = {
        ...validResult,
        zones: [{
          ...validResult.zones[0],
          polygon: [[0.1, 0.2], [0.3, 0.4]] // Only 2 points
        }]
      };
      const result = CastSenseResultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should allow optional fields to be omitted', () => {
      const minimal: CastSenseResult = {
        mode: 'general',
        zones: [],
        tactics: []
      };
      const result = CastSenseResultSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('should reject additional properties (strict mode)', () => {
      const invalid = { 
        ...validResult, 
        unknownField: 'should fail' 
      };
      const result = CastSenseResultSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Geometry Validation Tests (validateGeometry)
  // ============================================================================

  describe('Custom Geometry Validation', () => {
    it('should return no errors for valid result', () => {
      const errors = validateGeometry(validResult);
      expect(errors.filter(e => e.type === 'geometry')).toHaveLength(0);
      expect(errors.filter(e => e.type === 'integrity')).toHaveLength(0);
    });

    it('should detect zone-tactics consistency errors', () => {
      const inconsistent: CastSenseResult = {
        ...validResult,
        tactics: [
          {
            ...validResult.tactics[0]!,
            zone_id: 'NONEXISTENT' // References non-existent zone
          }
        ]
      };

      const errors = validateGeometry(inconsistent);
      const integrityErrors = errors.filter(e => e.type === 'integrity');
      expect(integrityErrors.length).toBeGreaterThan(0);
      expect(integrityErrors[0]!.message).toContain('non-existent zone_id');
    });

    it('should allow zones without tactics (warn only, no error)', () => {
      const zoneWithoutTactics: CastSenseResult = {
        ...validResult,
        zones: [
          ...validResult.zones,
          {
            zone_id: 'Z2',
            label: 'Secondary',
            confidence: 0.7,
            target_species: 'Smallmouth Bass',
            polygon: [[0.5, 0.5], [0.7, 0.5], [0.7, 0.7]],
            cast_arrow: { start: [0.6, 0.55], end: [0.65, 0.6] }
          }
        ]
        // tactics only references Z1
      };

      const errors = validateGeometry(zoneWithoutTactics);
      const integrityErrors = errors.filter(e => e.type === 'integrity');
      expect(integrityErrors).toHaveLength(0);
    });

    it('should return empty errors for minimal valid result', () => {
      const minimal: CastSenseResult = { mode: 'general', zones: [], tactics: [] };
      expect(validateGeometry(minimal)).toHaveLength(0);
    });
  });

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('hasValidStructure', () => {
    it('should return true for valid structure', () => {
      expect(hasValidStructure(validResult)).toBe(true);
    });

    it('should return false for null', () => {
      expect(hasValidStructure(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(hasValidStructure('string')).toBe(false);
      expect(hasValidStructure(123)).toBe(false);
    });

    it('should return false for missing mode', () => {
      const invalid = { zones: [], tactics: [] };
      expect(hasValidStructure(invalid)).toBe(false);
    });

    it('should return false for missing zones', () => {
      const invalid = { mode: 'general', tactics: [] };
      expect(hasValidStructure(invalid)).toBe(false);
    });

    it('should return false for missing tactics', () => {
      const invalid = { mode: 'general', zones: [] };
      expect(hasValidStructure(invalid)).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases (Schema level)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should accept minimal valid result', () => {
      const minimal: CastSenseResult = { mode: 'general', zones: [], tactics: [] };
      expect(CastSenseResultSchema.safeParse(minimal).success).toBe(true);
    });

    it('should accept maximum zones (10)', () => {
      const maxZones = {
        ...validResult,
        zones: Array.from({ length: 10 }, (_, i) => ({
          ...validResult.zones[0]!,
          zone_id: `Z${i + 1}`,
          label: `Zone ${i + 1}`
        })),
        tactics: Array.from({ length: 10 }, (_, i) => ({
          ...validResult.tactics[0]!,
          zone_id: `Z${i + 1}`
        }))
      };
      expect(CastSenseResultSchema.safeParse(maxZones).success).toBe(true);
    });

    it('should reject more than 10 zones', () => {
      const tooManyZones = {
        ...validResult,
        zones: Array.from({ length: 11 }, (_, i) => ({
          ...validResult.zones[0]!,
          zone_id: `Z${i + 1}`
        }))
      };
      expect(CastSenseResultSchema.safeParse(tooManyZones).success).toBe(false);
    });

    it('should accept video frame metadata', () => {
      const videoResult = {
        ...validResult,
        analysis_frame: {
          type: 'video_frame' as const,
          width_px: 1920,
          height_px: 1080,
          selected_frame_index: 5,
          frame_timestamp_ms: 1500
        }
      };
      const result = CastSenseResultSchema.safeParse(videoResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analysis_frame?.type).toBe('video_frame');
        expect(result.data.analysis_frame?.selected_frame_index).toBe(5);
      }
    });

    it('should accept empty arrays for optional fields', () => {
      const emptyOptionals = {
        ...validResult,
        likely_species: [],
        conditions_summary: [],
        plan_summary: []
      };
      expect(CastSenseResultSchema.safeParse(emptyOptionals).success).toBe(true);
    });

    it('should accept all zone style hints', () => {
      const hints = ['cover', 'structure', 'current', 'depth_edge', 'shade', 'inflow', 'unknown'] as const;
      for (const hint of hints) {
        const withHint = {
          ...validResult,
          zones: [{ ...validResult.zones[0]!, style: { hint } }]
        };
        expect(CastSenseResultSchema.safeParse(withHint).success).toBe(true);
      }
    });
  });
});

