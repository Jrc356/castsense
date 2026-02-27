/**
 * Tests for LangChain Structured Output Parsers
 */

import {
  parseAIResult,
  parseAIResultSync,
  hasValidStructure,
  getFormatInstructions,
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

  const validResultJSON = JSON.stringify(validResult, null, 2);

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
  // JSON Extraction Tests
  // ============================================================================

  describe('JSON Extraction', () => {
    it('should parse pure JSON', async () => {
      const result = await parseAIResult(validResultJSON);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toBeDefined();
    });

    it('should extract JSON from markdown code block', async () => {
      const wrapped = `\`\`\`json\n${validResultJSON}\n\`\`\``;
      const result = await parseAIResult(wrapped);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should extract JSON from markdown code block without language', async () => {
      const wrapped = `\`\`\`\n${validResultJSON}\n\`\`\``;
      const result = await parseAIResult(wrapped);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should extract JSON with leading prose', async () => {
      const withProse = `Here is the analysis result:\n\n${validResultJSON}`;
      const result = await parseAIResult(withProse);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should extract JSON with trailing prose', async () => {
      const withProse = `${validResultJSON}\n\nHope this helps!`;
      const result = await parseAIResult(withProse);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle nested JSON objects', async () => {
      const result = await parseAIResult(validResultJSON);
      expect(result.valid).toBe(true);
      const parsed = result.parsed as CastSenseResult;
      expect(parsed.zones.length).toBeGreaterThan(0);
      expect(parsed.zones[0]!.cast_arrow.start).toEqual([0.2, 0.25]);
    });

    it('should return parse error for invalid JSON', async () => {
      const invalid = '{ "mode": "general", invalid }';
      const result = await parseAIResult(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.type).toBe('schema');
    });

    it('should return parse error for empty string', async () => {
      const result = await parseAIResult('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.type).toBe('parse');
      expect(result.errors[0]!.message).toContain('No valid JSON');
    });

    it('should return parse error for non-JSON text', async () => {
      const result = await parseAIResult('This is just plain text without JSON');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.type).toBe('parse');
    });
  });

  // ============================================================================
  // Geometry Validation Tests
  // ============================================================================

  describe('Custom Geometry Validation', () => {
    it('should pass for valid normalized coordinates', async () => {
      const result = await parseAIResult(validResultJSON);
      expect(result.valid).toBe(true);
      expect(result.errors.filter(e => e.type === 'geometry')).toHaveLength(0);
    });

    it('should detect polygon points outside normalized bounds', async () => {
      const invalid = {
        ...validResult,
        zones: [{
          ...validResult.zones[0],
          polygon: [[0.5, 0.5], [1.5, 0.5], [0.5, 0.8]] // 1.5 > 1
        }]
      };
      
      // This should fail schema validation first
      const invalidJSON = JSON.stringify(invalid);
      const result = await parseAIResult(invalidJSON);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.type).toBe('schema');
    });

    it('should detect arrow points outside normalized bounds', async () => {
      const invalid = {
        ...validResult,
        zones: [{
          ...validResult.zones[0],
          cast_arrow: {
            start: [0.5, 0.5],
            end: [1.2, 0.5] // 1.2 > 1
          }
        }]
      };
      
      const invalidJSON = JSON.stringify(invalid);
      const result = await parseAIResult(invalidJSON);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.type).toBe('schema');
    });

    it('should validate retrieve path points', async () => {
      const withRetrievePath = {
        ...validResult,
        zones: [{
          ...validResult.zones[0],
          retrieve_path: [
            [0.2, 0.3],
            [0.3, 0.4],
            [0.4, 0.5]
          ]
        }]
      };
      
      const result = await parseAIResult(JSON.stringify(withRetrievePath));
      expect(result.valid).toBe(true);
    });

    it('should detect zone-tactics consistency errors', async () => {
      const inconsistent = {
        ...validResult,
        tactics: [
          {
            ...validResult.tactics[0],
            zone_id: 'NONEXISTENT' // References non-existent zone
          }
        ]
      };
      
      const result = await parseAIResult(JSON.stringify(inconsistent));
      expect(result.valid).toBe(false);
      
      const integrityErrors = result.errors.filter(e => e.type === 'integrity');
      expect(integrityErrors.length).toBeGreaterThan(0);
      expect(integrityErrors[0]!.message).toContain('non-existent zone_id');
    });

    it('should allow zones without tactics (warn only)', async () => {
      const zoneWithoutTactics = {
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
        // tactics still only references Z1
      };
      
      const result = await parseAIResult(JSON.stringify(zoneWithoutTactics));
      // Should be valid (no integrity error), but logs warning
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // Synchronous Parser Tests
  // ============================================================================

  describe('parseAIResultSync', () => {
    it('should parse valid JSON synchronously', () => {
      const result = parseAIResultSync(validResultJSON);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toBeDefined();
    });

    it('should handle schema validation errors', () => {
      const invalid = { mode: 'general' }; // Missing required fields
      const result = parseAIResultSync(JSON.stringify(invalid));
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.type).toBe('schema');
    });

    it('should extract JSON from markdown', () => {
      const wrapped = `\`\`\`json\n${validResultJSON}\n\`\`\``;
      const result = parseAIResultSync(wrapped);
      expect(result.valid).toBe(true);
    });

    it('should perform geometry validation', () => {
      const inconsistent = {
        ...validResult,
        tactics: [{ ...validResult.tactics[0], zone_id: 'BAD' }]
      };
      const result = parseAIResultSync(JSON.stringify(inconsistent));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'integrity')).toBe(true);
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

  describe('getFormatInstructions', () => {
    it('should return format instructions string', () => {
      const instructions = getFormatInstructions();
      expect(typeof instructions).toBe('string');
      expect(instructions.length).toBeGreaterThan(0);
      // Should contain schema information
      expect(instructions.toLowerCase()).toContain('json');
    });

    it('should be usable in prompts', () => {
      const instructions = getFormatInstructions();
      const prompt = `Analyze this fishing spot.\n\n${instructions}`;
      expect(prompt).toContain(instructions);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle minimal valid result', async () => {
      const minimal: CastSenseResult = {
        mode: 'general',
        zones: [],
        tactics: []
      };
      const result = await parseAIResult(JSON.stringify(minimal));
      expect(result.valid).toBe(true);
    });

    it('should handle maximum zones (10)', async () => {
      const maxZones = {
        ...validResult,
        zones: Array.from({ length: 10 }, (_, i) => ({
          ...validResult.zones[0],
          zone_id: `Z${i + 1}`,
          label: `Zone ${i + 1}`
        })),
        tactics: Array.from({ length: 10 }, (_, i) => ({
          ...validResult.tactics[0],
          zone_id: `Z${i + 1}`
        }))
      };
      const result = await parseAIResult(JSON.stringify(maxZones));
      expect(result.valid).toBe(true);
    });

    it('should reject more than 10 zones', async () => {
      const tooManyZones = {
        ...validResult,
        zones: Array.from({ length: 11 }, (_, i) => ({
          ...validResult.zones[0],
          zone_id: `Z${i + 1}`
        }))
      };
      const result = await parseAIResult(JSON.stringify(tooManyZones));
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.type).toBe('schema');
    });

    it('should handle video frame metadata', async () => {
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
      const result = await parseAIResult(JSON.stringify(videoResult));
      expect(result.valid).toBe(true);
      const parsed = result.parsed as CastSenseResult;
      expect(parsed.analysis_frame?.type).toBe('video_frame');
      expect(parsed.analysis_frame?.selected_frame_index).toBe(5);
    });

    it('should handle empty arrays for optional fields', async () => {
      const emptyOptionals = {
        ...validResult,
        likely_species: [],
        conditions_summary: [],
        plan_summary: []
      };
      const result = await parseAIResult(JSON.stringify(emptyOptionals));
      expect(result.valid).toBe(true);
    });

    it('should handle all zone style hints', async () => {
      const hints = ['cover', 'structure', 'current', 'depth_edge', 'shade', 'inflow', 'unknown'];
      
      for (const hint of hints) {
        const withHint = {
          ...validResult,
          zones: [{
            ...validResult.zones[0],
            style: { hint: hint as any }
          }]
        };
        const result = await parseAIResult(JSON.stringify(withHint));
        expect(result.valid).toBe(true);
      }
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should parse within reasonable time', async () => {
      const start = Date.now();
      await parseAIResult(validResultJSON);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // Should be fast
    });

    it('should handle multiple parses efficiently', async () => {
      const start = Date.now();
      const promises = Array.from({ length: 10 }, () => 
        parseAIResult(validResultJSON)
      );
      await Promise.all(promises);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500); // 10 parses in < 500ms
    });
  });
});
