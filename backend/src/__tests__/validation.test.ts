/**
 * Validation Unit Tests (T11.2)
 * 
 * Tests for AI output validation and repair functionality.
 */

import { 
  validateAIResult, 
  validateParsedResult,
  validateGeometry,
  validateReferentialIntegrity,
  extractJSON,
  isValidResult
} from '../services/validation';
import { buildTextOnlyFallback } from '../services/validation/fallback';
import { ContextPack } from '../types/enrichment';
import * as fs from 'fs';
import * as path from 'path';

// Load fixtures
const validResult = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/valid-result.json'), 'utf-8')
);
const invalidResult = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/invalid-result.json'), 'utf-8')
);

// Mock context pack for fallback tests
const mockContextPack: ContextPack = {
  mode: 'general',
  target_species: null,
  user_context: {
    platform: 'shore',
    gear_type: 'spinning'
  },
  location: {
    lat: 36.1234,
    lon: -95.5678,
    waterbody_name: 'Test Lake',
    water_type: 'lake',
    admin_area: 'Oklahoma',
    country: 'USA'
  },
  time: {
    timestamp_utc: '2026-02-17T14:30:00Z',
    local_time: '08:30',
    season: 'winter',
    sunrise_local: '07:00',
    sunset_local: '18:00',
    daylight_phase: 'day'
  },
  weather: null
};

describe('Validation Unit Tests (T11.2)', () => {
  describe('JSON Extraction', () => {
    test('extracts pure JSON object', () => {
      const rawJson = '{"mode": "general", "zones": [], "tactics": []}';
      const extracted = extractJSON(rawJson);
      expect(extracted).toBe(rawJson);
    });

    test('extracts JSON from markdown code block', () => {
      const rawWithMarkdown = '```json\n{"mode": "general", "zones": [], "tactics": []}\n```';
      const extracted = extractJSON(rawWithMarkdown);
      expect(extracted).not.toBeNull();
      const parsed = JSON.parse(extracted!);
      expect(parsed.mode).toBe('general');
    });

    test('extracts JSON with leading prose', () => {
      const rawWithProse = 'Here is the analysis:\n{"mode": "general", "zones": [], "tactics": []}';
      const extracted = extractJSON(rawWithProse);
      expect(extracted).not.toBeNull();
      const parsed = JSON.parse(extracted!);
      expect(parsed.mode).toBe('general');
    });

    test('returns null for non-JSON content', () => {
      const notJson = 'This is just plain text with no JSON';
      const extracted = extractJSON(notJson);
      expect(extracted).toBeNull();
    });
  });

  describe('Schema Validation', () => {
    test('validates correct result structure', () => {
      const result = validateAIResult(JSON.stringify(validResult));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects result with missing required mode field', () => {
      const missingMode = {
        zones: [],
        tactics: []
      };
      const result = validateAIResult(JSON.stringify(missingMode));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('mode'))).toBe(true);
    });

    test('rejects result with missing zones array', () => {
      const missingZones = {
        mode: 'general',
        tactics: []
      };
      const result = validateAIResult(JSON.stringify(missingZones));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('zones'))).toBe(true);
    });

    test('rejects result with missing tactics array', () => {
      const missingTactics = {
        mode: 'general',
        zones: []
      };
      const result = validateAIResult(JSON.stringify(missingTactics));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('tactics'))).toBe(true);
    });
  });

  describe('Geometry Validation', () => {
    test('validates correct normalized coordinates', () => {
      const result = validateGeometry(validResult);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects coordinates outside 0-1 range', () => {
      const badCoords = {
        mode: 'general',
        zones: [{
          zone_id: 'Z1',
          label: 'Primary',
          confidence: 0.9,
          target_species: 'Bass',
          polygon: [
            [1.5, 0.2],  // X > 1
            [0.3, -0.1], // Y < 0
            [0.3, 0.5]
          ],
          cast_arrow: {
            start: [0.5, 0.8],
            end: [0.2, 0.35]
          }
        }],
        tactics: []
      };

      const result = validateGeometry(badCoords);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'bounds')).toBe(true);
    });

    test('rejects polygon with less than 3 points', () => {
      const tooFewPoints = {
        mode: 'general',
        zones: [{
          zone_id: 'Z1',
          label: 'Primary',
          confidence: 0.9,
          target_species: 'Bass',
          polygon: [
            [0.1, 0.2],
            [0.3, 0.2]
            // Only 2 points
          ],
          cast_arrow: {
            start: [0.5, 0.8],
            end: [0.2, 0.35]
          }
        }],
        tactics: []
      };

      const result = validateGeometry(tooFewPoints);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'geometry' && e.message.includes('at least 3 points')
      )).toBe(true);
    });

    test('rejects confidence values outside 0-1 range', () => {
      const badConfidence = {
        mode: 'general',
        zones: [{
          zone_id: 'Z1',
          label: 'Primary',
          confidence: 1.5, // > 1
          target_species: 'Bass',
          polygon: [
            [0.1, 0.2],
            [0.3, 0.2],
            [0.3, 0.5]
          ],
          cast_arrow: {
            start: [0.5, 0.8],
            end: [0.2, 0.35]
          }
        }],
        tactics: []
      };

      const result = validateGeometry(badConfidence);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'bounds' && e.path.includes('confidence')
      )).toBe(true);
    });

    test('rejects cast arrow with out-of-bounds coordinates', () => {
      const badArrow = {
        mode: 'general',
        zones: [{
          zone_id: 'Z1',
          label: 'Primary',
          confidence: 0.9,
          target_species: 'Bass',
          polygon: [
            [0.1, 0.2],
            [0.3, 0.2],
            [0.3, 0.5]
          ],
          cast_arrow: {
            start: [0.5, 0.8],
            end: [2.0, 0.35] // X > 1
          }
        }],
        tactics: []
      };

      const result = validateGeometry(badArrow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'bounds' && e.path.includes('cast_arrow')
      )).toBe(true);
    });
  });

  describe('Referential Integrity Validation', () => {
    test('validates matching zone_ids in tactics', () => {
      const result = validateReferentialIntegrity(validResult);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects mismatched zone_id in tactics', () => {
      const mismatchedZoneId = {
        mode: 'general',
        zones: [{
          zone_id: 'Z1',
          label: 'Primary',
          confidence: 0.9,
          target_species: 'Bass',
          polygon: [[0.1, 0.2], [0.3, 0.2], [0.3, 0.5]],
          cast_arrow: { start: [0.5, 0.8], end: [0.2, 0.35] }
        }],
        tactics: [{
          zone_id: 'Z99', // Doesn't exist in zones
          recommended_rig: 'Senko',
          target_depth: '3-5 feet',
          retrieve_style: 'Slow',
          why_this_zone_works: ['Structure']
        }]
      };

      const result = validateReferentialIntegrity(mismatchedZoneId);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'integrity' && e.message.includes('does not match any zone')
      )).toBe(true);
    });

    test('rejects duplicate zone_ids', () => {
      const duplicateZoneId = {
        mode: 'general',
        zones: [
          {
            zone_id: 'Z1',
            label: 'Primary',
            confidence: 0.9,
            target_species: 'Bass',
            polygon: [[0.1, 0.2], [0.3, 0.2], [0.3, 0.5]],
            cast_arrow: { start: [0.5, 0.8], end: [0.2, 0.35] }
          },
          {
            zone_id: 'Z1', // Duplicate!
            label: 'Secondary',
            confidence: 0.8,
            target_species: 'Bass',
            polygon: [[0.5, 0.2], [0.7, 0.2], [0.7, 0.5]],
            cast_arrow: { start: [0.6, 0.8], end: [0.6, 0.35] }
          }
        ],
        tactics: []
      };

      const result = validateReferentialIntegrity(duplicateZoneId);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => 
        e.type === 'integrity' && e.message.includes('Duplicate zone_id')
      )).toBe(true);
    });

    test('zone without matching tactic is flagged', () => {
      const zoneMissingTactic = {
        mode: 'general',
        zones: [{
          zone_id: 'Z1',
          label: 'Primary',
          confidence: 0.9,
          target_species: 'Bass',
          polygon: [[0.1, 0.2], [0.3, 0.2], [0.3, 0.5]],
          cast_arrow: { start: [0.5, 0.8], end: [0.2, 0.35] }
        }],
        tactics: [{
          zone_id: 'Z2', // Different zone_id
          recommended_rig: 'Senko',
          target_depth: '3-5 feet',
          retrieve_style: 'Slow',
          why_this_zone_works: ['Structure']
        }]
      };

      const result = validateReferentialIntegrity(zoneMissingTactic);
      expect(result.valid).toBe(false);
      // Should flag both: zone without tactic AND tactic referencing nonexistent zone
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    test('allows N/A zone_id for text-only fallback', () => {
      const textOnlyResult = {
        mode: 'general',
        zones: [],
        tactics: [{
          zone_id: 'N/A',
          recommended_rig: 'Generic setup',
          target_depth: 'Variable',
          retrieve_style: 'Adjust to conditions',
          why_this_zone_works: ['General guidance']
        }]
      };

      const result = validateReferentialIntegrity(textOnlyResult);
      expect(result.valid).toBe(true);
    });
  });

  describe('Combined Validation', () => {
    test('validateAIResult runs all validators', () => {
      const result = validateAIResult(JSON.stringify(invalidResult));
      expect(result.valid).toBe(false);
      
      // Should have geometry errors (confidence > 1, bad coords)
      // And integrity errors (mismatched zone_id)
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check for different error types
      const errorTypes = new Set(result.errors.map(e => e.type));
      expect(errorTypes.size).toBeGreaterThan(1);
    });

    test('isValidResult quick check works', () => {
      expect(isValidResult(validResult)).toBe(true);
      expect(isValidResult(invalidResult)).toBe(false);
    });

    test('validateParsedResult validates already-parsed JSON', () => {
      const result = validateParsedResult(validResult);
      expect(result.valid).toBe(true);

      const invalidValidation = validateParsedResult(invalidResult);
      expect(invalidValidation.valid).toBe(false);
    });
  });

  describe('Text-Only Fallback (T5.5)', () => {
    test('buildTextOnlyFallback returns degraded status', () => {
      const fallback = buildTextOnlyFallback(invalidResult, mockContextPack);
      
      expect(fallback.status).toBe('degraded');
      expect(fallback.renderingMode).toBe('text_only');
    });

    test('fallback has empty zones array', () => {
      const fallback = buildTextOnlyFallback(invalidResult, mockContextPack);
      
      expect(fallback.result.zones).toEqual([]);
    });

    test('fallback tactics have N/A zone_id', () => {
      const fallback = buildTextOnlyFallback(invalidResult, mockContextPack);
      
      expect(fallback.result.tactics.length).toBeGreaterThan(0);
      expect(fallback.result.tactics[0]!.zone_id).toBe('N/A');
    });

    test('fallback extracts valid content from original when possible', () => {
      // Create a partially valid result with some extractable content
      const partialResult = {
        mode: 'general',
        zones: [], // Invalid or empty
        tactics: [],
        plan_summary: ['Focus on structure', 'Try slow presentations'],
        conditions_summary: ['Clear skies', 'Moderate wind']
      };

      const fallback = buildTextOnlyFallback(partialResult, mockContextPack);
      
      expect(fallback.result.plan_summary).toContain('Focus on structure');
      expect(fallback.result.conditions_summary).toContain('Clear skies');
    });

    test('fallback generates generic content when extraction fails', () => {
      const emptyResult = {};
      
      const fallback = buildTextOnlyFallback(emptyResult, mockContextPack);
      
      expect(fallback.result.plan_summary.length).toBeGreaterThan(0);
      expect(fallback.result.tactics[0]!.recommended_rig).toBeDefined();
      expect(fallback.result.tactics[0]!.why_this_zone_works.length).toBeGreaterThan(0);
    });

    test('fallback uses context pack mode', () => {
      const specificContextPack: ContextPack = {
        ...mockContextPack,
        mode: 'specific',
        target_species: 'Largemouth Bass'
      };

      const fallback = buildTextOnlyFallback({}, specificContextPack);
      
      expect(fallback.result.mode).toBe('specific');
    });
  });

  describe('Error Message Quality', () => {
    test('validation errors have readable paths', () => {
      const badResult = {
        mode: 'general',
        zones: [{
          zone_id: 'Z1',
          label: 'Primary',
          confidence: 1.5,
          target_species: 'Bass',
          polygon: [[0.1, 0.2], [0.3, 0.2], [1.5, 0.5]],
          cast_arrow: { start: [0.5, 0.8], end: [0.2, 0.35] }
        }],
        tactics: []
      };

      const result = validateAIResult(JSON.stringify(badResult));
      
      // Paths should be human-readable
      result.errors.forEach(error => {
        expect(error.path).toBeDefined();
        expect(typeof error.path).toBe('string');
        // Should have readable path like "zones[0].confidence" not just "/zones/0/confidence"
      });
    });

    test('validation errors include problematic values', () => {
      const badResult = {
        mode: 'general',
        zones: [{
          zone_id: 'Z1',
          label: 'Primary',
          confidence: 1.5,
          target_species: 'Bass',
          polygon: [[0.1, 0.2], [0.3, 0.2], [0.3, 0.5]],
          cast_arrow: { start: [0.5, 0.8], end: [0.2, 0.35] }
        }],
        tactics: []
      };

      const result = validateAIResult(JSON.stringify(badResult));
      
      const confidenceError = result.errors.find(e => e.path.includes('confidence'));
      expect(confidenceError).toBeDefined();
      expect(confidenceError!.value).toBe(1.5);
    });
  });
});
