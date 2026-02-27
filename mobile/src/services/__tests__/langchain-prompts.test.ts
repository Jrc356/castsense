/**
 * Tests for LangChain Prompt Templates
 * 
 * Verifies:
 * 1. Templates render correctly with sample data
 * 2. Regression: output matches current implementation format
 * 3. Edge cases (missing enrichment, partial data)
 */

import {
  buildContextPack,
  buildPromptVariables,
  formatAnalysisPrompt,
  getPromptTemplate,
  type ContextPack,
  type AnalysisOptions
} from '../langchain-prompts';
import type { EnrichmentResults } from '../enrichment';

// ============================================================================
// Test Data
// ============================================================================

const MOCK_LOCATION = {
  lat: 41.8781,
  lon: -87.6298
};

const MOCK_ENRICHMENT_FULL: EnrichmentResults = {
  reverseGeocode: {
    success: true,
    waterbody_name: 'Lake Michigan',
    water_type: 'lake',
    admin_area: 'Illinois',
    country: 'USA'
  },
  weather: {
    success: true,
    temperature_f: 72,
    wind_speed_mph: 8,
    wind_direction_deg: 180,
    cloud_cover_pct: 25,
    pressure_inhg: 30.1,
    pressure_trend: 'rising',
    precip_24h_in: 0.0
  },
  solar: {
    success: true,
    season: 'summer',
    sunrise_local: '05:45',
    sunset_local: '20:30',
    daylight_phase: 'afternoon'
  }
};

const MOCK_ENRICHMENT_PARTIAL: EnrichmentResults = {
  reverseGeocode: {
    success: true,
    waterbody_name: 'Unknown Lake',
    water_type: 'unknown',
    admin_area: null,
    country: null
  },
  weather: {
    success: false
  },
  solar: {
    success: false
  }
};

const MOCK_OPTIONS_GENERAL: AnalysisOptions = {
  mode: 'general'
};

const MOCK_OPTIONS_SPECIFIC: AnalysisOptions = {
  mode: 'specific',
  targetSpecies: 'Largemouth Bass',
  platform: 'kayak',
  gearType: 'spinning'
};

// ============================================================================
// buildContextPack Tests
// ============================================================================

describe('buildContextPack', () => {
  it('should build full context pack with all enrichment data', () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    expect(contextPack.mode).toBe('general');
    expect(contextPack.target_species).toBeNull();
    
    expect(contextPack.location).toEqual({
      lat: 41.8781,
      lon: -87.6298,
      waterbody_name: 'Lake Michigan',
      water_type: 'lake',
      admin_area: 'Illinois',
      country: 'USA'
    });

    expect(contextPack.time).toBeDefined();
    expect(contextPack.time?.season).toBe('summer');
    expect(contextPack.time?.sunrise_local).toBe('05:45');
    expect(contextPack.time?.sunset_local).toBe('20:30');
    expect(contextPack.time?.daylight_phase).toBe('afternoon');
    expect(contextPack.time?.local_time).toMatch(/^\d{2}:\d{2}$/);

    expect(contextPack.weather).toEqual({
      air_temp_f: 72,
      wind_speed_mph: 8,
      wind_direction_deg: 180,
      cloud_cover_pct: 25,
      pressure_inhg: 30.1,
      pressure_trend: 'rising',
      precip_last_24h_in: 0.0
    });

    expect(contextPack.user_context).toBeUndefined();
  });

  it('should include target species and user context in specific mode', () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_SPECIFIC
    );

    expect(contextPack.mode).toBe('specific');
    expect(contextPack.target_species).toBe('Largemouth Bass');
    expect(contextPack.user_context).toEqual({
      platform: 'kayak',
      gear_type: 'spinning'
    });
  });

  it('should handle missing enrichment data gracefully', () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_PARTIAL,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    expect(contextPack.mode).toBe('general');
    expect(contextPack.location).toBeDefined();
    expect(contextPack.time).toBeUndefined();
    expect(contextPack.weather).toBeUndefined();
  });

  it('should handle empty enrichment', () => {
    const emptyEnrichment: EnrichmentResults = {
      reverseGeocode: { success: false },
      weather: { success: false },
      solar: { success: false }
    };

    const contextPack = buildContextPack(
      emptyEnrichment,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    expect(contextPack.mode).toBe('general');
    expect(contextPack.location).toBeUndefined();
    expect(contextPack.time).toBeUndefined();
    expect(contextPack.weather).toBeUndefined();
  });

  it('should handle partial user context', () => {
    const optionsOnlyPlatform: AnalysisOptions = {
      mode: 'general',
      platform: 'shore'
    };

    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      optionsOnlyPlatform
    );

    expect(contextPack.user_context).toEqual({
      platform: 'shore',
      gear_type: undefined
    });
  });
});

// ============================================================================
// buildPromptVariables Tests
// ============================================================================

describe('buildPromptVariables', () => {
  it('should format full context pack into template variables', () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    const variables = buildPromptVariables(contextPack);

    expect(variables.mode).toBe('MODE: general');
    expect(variables.target_species).toBe('');
    expect(variables.user_context).toBe('');
    
    expect(variables.location).toContain('LOCATION:');
    expect(variables.location).toContain('Coordinates: 41.8781, -87.6298');
    expect(variables.location).toContain('Waterbody: Lake Michigan');
    expect(variables.location).toContain('Type: lake');
    expect(variables.location).toContain('Area: Illinois');
    expect(variables.location).toContain('Country: USA');

    expect(variables.time).toContain('TIME:');
    expect(variables.time).toContain('Local time:');
    expect(variables.time).toContain('Season: summer');
    expect(variables.time).toContain('Sunrise: 05:45, Sunset: 20:30');
    expect(variables.time).toContain('Daylight phase: afternoon');

    expect(variables.weather).toContain('WEATHER:');
    expect(variables.weather).toContain('Air temp: 72°F');
    expect(variables.weather).toContain('Wind: 8 mph at 180°');
    expect(variables.weather).toContain('Cloud cover: 25%');
    expect(variables.weather).toContain('Precipitation (24h): 0 in');
    expect(variables.weather).toContain('Pressure: 30.1 inHg (rising)');

    expect(variables.mode_instructions).toContain('General Mode');
    expect(variables.mode_instructions).toContain('likely_species array');
  });

  it('should format specific mode with target species', () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_SPECIFIC
    );

    const variables = buildPromptVariables(contextPack);

    expect(variables.mode).toContain('MODE: specific');
    expect(variables.mode).toContain('TARGET SPECIES: Largemouth Bass');
    
    expect(variables.user_context).toContain('USER CONTEXT:');
    expect(variables.user_context).toContain('Platform: kayak');
    expect(variables.user_context).toContain('Gear: spinning');

    expect(variables.mode_instructions).toContain('Specific Mode');
    expect(variables.mode_instructions).toContain('Largemouth Bass');
  });

  it('should handle missing sections gracefully', () => {
    const minimalContextPack: ContextPack = {
      mode: 'general',
      target_species: null
    };

    const variables = buildPromptVariables(minimalContextPack);

    expect(variables.mode).toBe('MODE: general');
    expect(variables.target_species).toBe('');
    expect(variables.user_context).toBe('');
    expect(variables.location).toBe('');
    expect(variables.time).toBe('');
    expect(variables.weather).toBe('');
    expect(variables.mode_instructions).toContain('General Mode');
  });

  it('should not include unknown water type in location', () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_PARTIAL,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    const variables = buildPromptVariables(contextPack);

    expect(variables.location).toContain('LOCATION:');
    expect(variables.location).toContain('Waterbody: Unknown Lake');
    expect(variables.location).not.toContain('Type: unknown');
  });
});

// ============================================================================
// formatAnalysisPrompt Tests
// ============================================================================

describe('formatAnalysisPrompt', () => {
  it('should generate complete prompt text', async () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    const prompt = await formatAnalysisPrompt(contextPack);

    // Verify main sections are present
    expect(prompt).toContain('You are CastSense');
    expect(prompt).toContain('TASK:');
    expect(prompt).toContain('MODE: general');
    expect(prompt).toContain('LOCATION:');
    expect(prompt).toContain('TIME:');
    expect(prompt).toContain('WEATHER:');
    expect(prompt).toContain('MODE INSTRUCTIONS (General Mode)');
    expect(prompt).toContain('SAFETY AND COMPLIANCE:');
    expect(prompt).toContain('OUTPUT REQUIREMENTS:');
    expect(prompt).toContain('ZONE REQUIREMENTS:');
    expect(prompt).toContain('OUTPUT SCHEMA:');
    expect(prompt).toContain('ANALYSIS INSTRUCTIONS:');
    expect(prompt).toContain('Remember: Return ONLY the JSON object');
  });

  it('should include target species in specific mode prompt', async () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_SPECIFIC
    );

    const prompt = await formatAnalysisPrompt(contextPack);

    expect(prompt).toContain('MODE: specific');
    expect(prompt).toContain('TARGET SPECIES: Largemouth Bass');
    expect(prompt).toContain('USER CONTEXT:');
    expect(prompt).toContain('Platform: kayak');
    expect(prompt).toContain('Gear: spinning');
    expect(prompt).toContain('MODE INSTRUCTIONS (Specific Mode)');
    expect(prompt).toContain('targeting Largemouth Bass');
  });

  it('should handle minimal context', async () => {
    const minimalContextPack: ContextPack = {
      mode: 'general',
      target_species: null
    };

    const prompt = await formatAnalysisPrompt(minimalContextPack);

    expect(prompt).toContain('You are CastSense');
    expect(prompt).toContain('MODE: general');
    expect(prompt).toContain('MODE INSTRUCTIONS (General Mode)');
    
    // Should still have structure even with missing data
    expect(prompt).not.toContain('LOCATION:');
    expect(prompt).not.toContain('TIME:');
    expect(prompt).not.toContain('WEATHER:');
  });
});

// ============================================================================
// Regression Tests (Output Format Matching)
// ============================================================================

describe('Regression: Output Format Matching', () => {
  it('should match original prompt structure for general mode', async () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    const prompt = await formatAnalysisPrompt(contextPack);

    // Verify key structural elements match original implementation
    const lines = prompt.split('\n');
    
    // Should have CastSense intro
    expect(lines[0]).toContain('You are CastSense');
    
    // Should have MODE section
    const modeLineIndex = lines.findIndex(l => l.startsWith('MODE:'));
    expect(modeLineIndex).toBeGreaterThan(-1);
    expect(lines[modeLineIndex]).toBe('MODE: general');

    // Should have LOCATION section with proper formatting
    const locationIndex = lines.findIndex(l => l.startsWith('LOCATION:'));
    expect(locationIndex).toBeGreaterThan(-1);
    expect(lines[locationIndex + 1]).toMatch(/^Coordinates: \d+\.\d+, -?\d+\.\d+$/);

    // Should have TIME section
    const timeIndex = lines.findIndex(l => l.startsWith('TIME:'));
    expect(timeIndex).toBeGreaterThan(-1);
    expect(lines[timeIndex + 1]).toMatch(/^Local time: \d{2}:\d{2}$/);

    // Should have WEATHER section
    const weatherIndex = lines.findIndex(l => l.startsWith('WEATHER:'));
    expect(weatherIndex).toBeGreaterThan(-1);
    expect(lines[weatherIndex + 1]).toMatch(/^Air temp: \d+°F$/);

    // Should have MODE INSTRUCTIONS
    expect(prompt).toContain('MODE INSTRUCTIONS (General Mode):');
    
    // Should end with JSON reminder
    expect(prompt.trim().endsWith('Remember: Return ONLY the JSON object, no additional text.')).toBe(true);
  });

  it('should match original prompt structure for specific mode', async () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_SPECIFIC
    );

    const prompt = await formatAnalysisPrompt(contextPack);

    // Specific mode should have target species
    expect(prompt).toMatch(/TARGET SPECIES: Largemouth Bass/);
    
    // Should have user context section
    expect(prompt).toContain('USER CONTEXT:');
    expect(prompt).toContain('Platform: kayak');
    expect(prompt).toContain('Gear: spinning');

    // Mode instructions should be for specific mode
    expect(prompt).toContain('MODE INSTRUCTIONS (Specific Mode):');
    expect(prompt).toContain('targeting Largemouth Bass specifically');
  });

  it('should include all schema and constraint information', async () => {
    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    const prompt = await formatAnalysisPrompt(contextPack);

    // Verify schema is present
    expect(prompt).toContain('OUTPUT SCHEMA:');
    expect(prompt).toContain('"mode": "general" | "specific"');
    expect(prompt).toContain('"likely_species"');
    expect(prompt).toContain('"zones"');
    expect(prompt).toContain('"tactics"');
    expect(prompt).toContain('"conditions_summary"');
    expect(prompt).toContain('"explainability"');

    // Verify constraints are present
    expect(prompt).toContain('ZONE REQUIREMENTS:');
    expect(prompt).toContain('Return 1-3 zones maximum');
    expect(prompt).toContain('zone_id must be unique');
    expect(prompt).toContain('All coordinates must be in range [0, 1]');
    expect(prompt).toContain('(0,0) = top-left, (1,1) = bottom-right');
  });
});

// ============================================================================
// Template Introspection Tests
// ============================================================================

describe('getPromptTemplate', () => {
  it('should return LangChain ChatPromptTemplate', () => {
    const template = getPromptTemplate();
    expect(template).toBeDefined();
    expect(template.inputVariables).toBeDefined();
  });

  it('should have required input variables', () => {
    const template = getPromptTemplate();
    const inputVars = template.inputVariables;

    expect(inputVars).toContain('mode');
    expect(inputVars).toContain('user_context');
    expect(inputVars).toContain('location');
    expect(inputVars).toContain('time');
    expect(inputVars).toContain('weather');
    expect(inputVars).toContain('mode_instructions');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle coordinates with high precision', () => {
    const highPrecisionLocation = {
      lat: 41.87812345,
      lon: -87.62984567
    };

    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      highPrecisionLocation,
      MOCK_OPTIONS_GENERAL
    );

    const variables = buildPromptVariables(contextPack);
    
    // Should be formatted to 4 decimal places
    expect(variables.location).toContain('41.8781, -87.6298');
  });

  it('should handle zero values in weather data', () => {
    const zeroWeatherEnrichment: EnrichmentResults = {
      ...MOCK_ENRICHMENT_FULL,
      weather: {
        success: true,
        temperature_f: 0,
        wind_speed_mph: 0,
        wind_direction_deg: 0,
        cloud_cover_pct: 0,
        pressure_inhg: 0,
        pressure_trend: 'steady',
        precip_24h_in: 0
      }
    };

    const contextPack = buildContextPack(
      zeroWeatherEnrichment,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    const variables = buildPromptVariables(contextPack);
    
    expect(variables.weather).toContain('Air temp: 0°F');
    expect(variables.weather).toContain('Wind: 0 mph at 0°');
    expect(variables.weather).toContain('Cloud cover: 0%');
  });

  it('should handle empty strings in optional fields', () => {
    const emptyStringsOptions: AnalysisOptions = {
      mode: 'specific',
      targetSpecies: '',
      platform: 'shore',
      gearType: 'spinning'
    };

    const contextPack = buildContextPack(
      MOCK_ENRICHMENT_FULL,
      MOCK_LOCATION,
      emptyStringsOptions
    );

    expect(contextPack.target_species).toBe('');
    
    const variables = buildPromptVariables(contextPack);
    expect(variables.mode).toBe('MODE: specific');
    expect(variables.target_species).toBe('');
  });

  it('should handle very long waterbody names', () => {
    const longNameEnrichment: EnrichmentResults = {
      ...MOCK_ENRICHMENT_FULL,
      reverseGeocode: {
        success: true,
        waterbody_name: 'Lake of the Woods International Wilderness Area Reservoir System',
        water_type: 'lake',
        admin_area: 'Minnesota',
        country: 'USA'
      }
    };

    const contextPack = buildContextPack(
      longNameEnrichment,
      MOCK_LOCATION,
      MOCK_OPTIONS_GENERAL
    );

    const variables = buildPromptVariables(contextPack);
    
    expect(variables.location).toContain('Waterbody: Lake of the Woods International Wilderness Area Reservoir System');
  });
});
