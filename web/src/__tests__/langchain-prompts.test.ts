/**
 * LangChain Prompt Templates Tests
 * 
 * Tests prompt template formatting and context pack building,
 * especially enrichment data transformation.
 */

import { 
  buildContextPack,
  buildPromptVariables,
  formatAnalysisPrompt,
  PROMPT_VERSION,
  type AnalysisOptions 
} from '../services/langchain-prompts';
import type { EnrichmentResults } from '../services/enrichment';

// ============================================================================
// Test Fixtures
// ============================================================================

const FULL_ENRICHMENT: EnrichmentResults = {
  reverseGeocode: {
    waterbody_name: 'Lake Michigan',
    water_type: 'lake',
    admin_area: 'Cook County',
    country: 'USA'
  },
  weather: {
    temperature_f: 68,
    wind_speed_mph: 8,
    wind_direction_deg: 270,
    cloud_cover_pct: 40,
    pressure_inhg: 30.1,
    pressure_trend: 'rising',
    precip_24h_in: 0.1
  },
  solar: {
    sunrise_local: '06:15',
    sunset_local: '19:45',
    season: 'summer',
    daylight_phase: 'day'
  }
};

const PARTIAL_ENRICHMENT: EnrichmentResults = {
  reverseGeocode: {
    waterbody_name: 'Unknown Lake',
    water_type: 'unknown',
    admin_area: null,
    country: null
  },
  weather: null,
  solar: null
};

const MINIMAL_ENRICHMENT: EnrichmentResults = {
  reverseGeocode: null,
  weather: null,
  solar: null
};

const LOCATION = { lat: 41.8781, lon: -87.6298 };

// ============================================================================
// Test Suites
// ============================================================================

describe('buildContextPack', () => {
  describe('enrichment integration', () => {
    it('should transform full enrichment data to context pack', () => {
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      // Verify mode
      expect(contextPack.mode).toBe('general');
      expect(contextPack.target_species).toBeNull();

      // Verify location data
      expect(contextPack.location).toBeDefined();
      expect(contextPack.location?.lat).toBe(41.8781);
      expect(contextPack.location?.lon).toBe(-87.6298);
      expect(contextPack.location?.waterbody_name).toBe('Lake Michigan');
      expect(contextPack.location?.water_type).toBe('lake');
      expect(contextPack.location?.admin_area).toBe('Cook County');
      expect(contextPack.location?.country).toBe('USA');

      // Verify weather data
      expect(contextPack.weather).toBeDefined();
      expect(contextPack.weather?.air_temp_f).toBe(68);
      expect(contextPack.weather?.wind_speed_mph).toBe(8);
      expect(contextPack.weather?.wind_direction_deg).toBe(270);
      expect(contextPack.weather?.cloud_cover_pct).toBe(40);
      expect(contextPack.weather?.pressure_inhg).toBe(30.1);
      expect(contextPack.weather?.pressure_trend).toBe('rising');
      expect(contextPack.weather?.precip_last_24h_in).toBe(0.1);

      // Verify solar/time data
      expect(contextPack.time).toBeDefined();
      expect(contextPack.time?.season).toBe('summer');
      expect(contextPack.time?.sunrise_local).toBe('06:15');
      expect(contextPack.time?.sunset_local).toBe('19:45');
      expect(contextPack.time?.daylight_phase).toBe('day');
      expect(contextPack.time?.local_time).toMatch(/^\d{2}:\d{2}$/); // HH:MM format
    });

    it('should handle partial enrichment (only reverse geocode)', () => {
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(PARTIAL_ENRICHMENT, LOCATION, options);

      // Should have location but with limited data
      expect(contextPack.location).toBeDefined();
      expect(contextPack.location?.waterbody_name).toBe('Unknown Lake');
      expect(contextPack.location?.water_type).toBe('unknown');
      expect(contextPack.location?.admin_area).toBeNull();
      expect(contextPack.location?.country).toBeNull();

      // Should not have weather or time
      expect(contextPack.weather).toBeUndefined();
      expect(contextPack.time).toBeUndefined();
    });

    it('should handle minimal enrichment (all services failed)', () => {
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(MINIMAL_ENRICHMENT, LOCATION, options);

      // Should only have mode
      expect(contextPack.mode).toBe('general');
      expect(contextPack.location).toBeUndefined();
      expect(contextPack.weather).toBeUndefined();
      expect(contextPack.time).toBeUndefined();
      expect(contextPack.user_context).toBeUndefined();
    });

    it('should handle weather without solar data', () => {
      const enrichment: EnrichmentResults = {
        reverseGeocode: null,
        weather: FULL_ENRICHMENT.weather,
        solar: null
      };
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(enrichment, LOCATION, options);

      expect(contextPack.weather).toBeDefined();
      expect(contextPack.weather?.air_temp_f).toBe(68);
      expect(contextPack.time).toBeUndefined(); // No solar = no time context
    });

    it('should handle solar without weather data', () => {
      const enrichment: EnrichmentResults = {
        reverseGeocode: null,
        weather: null,
        solar: FULL_ENRICHMENT.solar
      };
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(enrichment, LOCATION, options);

      expect(contextPack.time).toBeDefined();
      expect(contextPack.time?.season).toBe('summer');
      expect(contextPack.weather).toBeUndefined();
    });
  });

  describe('specific mode with target species', () => {
    it('should include target species for specific mode', () => {
      const options: AnalysisOptions = { 
        mode: 'specific',
        targetSpecies: 'Rainbow Trout'
      };
      
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      expect(contextPack.mode).toBe('specific');
      expect(contextPack.target_species).toBe('Rainbow Trout');
    });

    it('should handle specific mode without target species', () => {
      const options: AnalysisOptions = { 
        mode: 'specific'
        // targetSpecies intentionally undefined
      };
      
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      expect(contextPack.mode).toBe('specific');
      expect(contextPack.target_species).toBeNull();
    });
  });

  describe('user context (platform and gear)', () => {
    it('should include platform and gear type when provided', () => {
      const options: AnalysisOptions = { 
        mode: 'general',
        platform: 'shore',
        gearType: 'spinning'
      };
      
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      expect(contextPack.user_context).toBeDefined();
      expect(contextPack.user_context?.platform).toBe('shore');
      expect(contextPack.user_context?.gear_type).toBe('spinning');
    });

    it('should include only platform when gear type not provided', () => {
      const options: AnalysisOptions = { 
        mode: 'general',
        platform: 'kayak'
      };
      
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      expect(contextPack.user_context).toBeDefined();
      expect(contextPack.user_context?.platform).toBe('kayak');
      expect(contextPack.user_context?.gear_type).toBeUndefined();
    });

    it('should include only gear type when platform not provided', () => {
      const options: AnalysisOptions = { 
        mode: 'general',
        gearType: 'fly'
      };
      
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      expect(contextPack.user_context).toBeDefined();
      expect(contextPack.user_context?.platform).toBeUndefined();
      expect(contextPack.user_context?.gear_type).toBe('fly');
    });

    it('should not include user_context when neither provided', () => {
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      expect(contextPack.user_context).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle extreme coordinates', () => {
      const extremeLocation = { lat: -89.9999, lon: 179.9999 };
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(FULL_ENRICHMENT, extremeLocation, options);

      expect(contextPack.location?.lat).toBe(-89.9999);
      expect(contextPack.location?.lon).toBe(179.9999);
    });

    it('should handle zero pressure trend (edge case)', () => {
      const enrichment: EnrichmentResults = {
        reverseGeocode: null,
        weather: {
          ...FULL_ENRICHMENT.weather!,
          pressure_trend: 'steady'
        },
        solar: null
      };
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(enrichment, LOCATION, options);

      expect(contextPack.weather?.pressure_trend).toBe('steady');
    });

    it('should handle zero precipitation', () => {
      const enrichment: EnrichmentResults = {
        reverseGeocode: null,
        weather: {
          ...FULL_ENRICHMENT.weather!,
          precip_24h_in: 0
        },
        solar: null
      };
      const options: AnalysisOptions = { mode: 'general' };
      
      const contextPack = buildContextPack(enrichment, LOCATION, options);

      expect(contextPack.weather?.precip_last_24h_in).toBe(0);
    });
  });

  describe('data transformation correctness', () => {
    it('should use correct field names for context pack', () => {
      const options: AnalysisOptions = { mode: 'general' };
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      // Verify field name transformations
      // EnrichmentResults uses: temperature_f, precip_24h_in
      // ContextPack uses: air_temp_f, precip_last_24h_in
      expect(contextPack.weather?.air_temp_f).toBe(FULL_ENRICHMENT.weather?.temperature_f);
      expect(contextPack.weather?.precip_last_24h_in).toBe(FULL_ENRICHMENT.weather?.precip_24h_in);
    });

    it('should not leak extra properties', () => {
      const options: AnalysisOptions = { mode: 'general' };
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      // Ensure we only have expected top-level keys
      const allowedKeys = ['mode', 'target_species', 'location', 'time', 'weather', 'user_context'];
      const actualKeys = Object.keys(contextPack);
      
      for (const key of actualKeys) {
        expect(allowedKeys).toContain(key);
      }
    });
  });
});

describe('formatAnalysisPrompt', () => {
  it('should format prompt with full context pack', async () => {
    const options: AnalysisOptions = { mode: 'general' };
    const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);
    
    const prompt = await formatAnalysisPrompt(contextPack);

    // Verify prompt contains key sections
    expect(prompt).toContain('MODE: general');
    expect(prompt).toContain('Lake Michigan');
    expect(prompt).toContain('WEATHER');
    expect(prompt).toContain('TIME');
    expect(prompt.length).toBeGreaterThan(500); // Should be substantial
  });

  it('should format prompt with minimal context pack', async () => {
    const options: AnalysisOptions = { mode: 'general' };
    const contextPack = buildContextPack(MINIMAL_ENRICHMENT, LOCATION, options);
    
    const prompt = await formatAnalysisPrompt(contextPack);

    // Should still generate valid prompt even without enrichment
    expect(prompt).toBeDefined();
    expect(prompt.length).toBeGreaterThan(200);
  });

  it('should format specific mode prompt', async () => {
    const options: AnalysisOptions = { 
      mode: 'specific',
      targetSpecies: 'Largemouth Bass'
    };
    const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);
    
    const prompt = await formatAnalysisPrompt(contextPack);

    // Specific mode should mention target species
    expect(prompt).toContain('Largemouth Bass');
    expect(prompt).toContain('specific');
  });

  it('should include XML structural tags', async () => {
    const options: AnalysisOptions = { mode: 'general' };
    const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

    const prompt = await formatAnalysisPrompt(contextPack);

    expect(prompt).toContain('<context>');
    expect(prompt).toContain('</context>');
    expect(prompt).toContain('<zone_requirements>');
    expect(prompt).toContain('</zone_requirements>');
    expect(prompt).toContain('<output_schema>');
    expect(prompt).toContain('<structured_output_contract>');
    expect(prompt).toContain('<example>');
    expect(prompt).toContain('<analysis_instructions>');
  });

  it('should include gear instructions in prompt when fly gear selected', async () => {
    const options: AnalysisOptions = { mode: 'general', gearType: 'fly' };
    const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

    const prompt = await formatAnalysisPrompt(contextPack);

    expect(prompt).toContain('<gear_instructions>');
    expect(prompt).toContain('nymph');
    expect(prompt).toContain('streamer');
    // Verify SPINNING gear instruction block is not present (fly block only)
    expect(prompt).not.toContain('SPINNING gear');
  });

  it('should not include gear instructions without gear type', async () => {
    const options: AnalysisOptions = { mode: 'general' };
    const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

    const prompt = await formatAnalysisPrompt(contextPack);

    // No closing tag means no gear instruction block was rendered
    expect(prompt).not.toContain('</gear_instructions>');
  });
});

describe('buildPromptVariables', () => {
  describe('gear instructions', () => {
    it('should include fly-specific instructions and exclude spinning terms', () => {
      const options: AnalysisOptions = { mode: 'general', gearType: 'fly' };
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      const vars = buildPromptVariables(contextPack);

      expect(vars.formatted_context).toContain('<gear_instructions>');
      expect(vars.formatted_context).toContain('nymph');
      expect(vars.formatted_context).toContain('streamer');
      expect(vars.formatted_context).toContain('drift');
      // Verify the SPINNING gear instruction section is absent
      expect(vars.formatted_context).not.toContain('SPINNING gear');
    });

    it('should include spinning-specific instructions and exclude fly terms', () => {
      const options: AnalysisOptions = { mode: 'general', gearType: 'spinning' };
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      const vars = buildPromptVariables(contextPack);

      expect(vars.formatted_context).toContain('<gear_instructions>');
      expect(vars.formatted_context).toContain('crankbait');
      expect(vars.formatted_context).toContain('jig');
      // Verify the FLY FISHING gear instruction section is absent
      expect(vars.formatted_context).not.toContain('FLY FISHING gear');
    });

    it('should include baitcasting-specific instructions', () => {
      const options: AnalysisOptions = { mode: 'general', gearType: 'baitcasting' };
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      const vars = buildPromptVariables(contextPack);

      expect(vars.formatted_context).toContain('<gear_instructions>');
      expect(vars.formatted_context).toContain('flipping');
      expect(vars.formatted_context).toContain('pitching');
    });

    it('should not include gear instructions when gearType is unknown', () => {
      const options: AnalysisOptions = { mode: 'general', gearType: 'unknown' };
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      const vars = buildPromptVariables(contextPack);

      expect(vars.formatted_context).not.toContain('</gear_instructions>');
    });

    it('should not include gear instructions when gearType is absent', () => {
      const options: AnalysisOptions = { mode: 'general' };
      const contextPack = buildContextPack(FULL_ENRICHMENT, LOCATION, options);

      const vars = buildPromptVariables(contextPack);

      expect(vars.formatted_context).not.toContain('</gear_instructions>');
    });
  });
});

describe('PROMPT_VERSION', () => {
  it('should have valid semantic version', () => {
    expect(PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should be at least version 1.0.0', () => {
    const [major, minor, patch] = PROMPT_VERSION.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(1);
    expect(minor).toBeGreaterThanOrEqual(0);
    expect(patch).toBeGreaterThanOrEqual(0);
  });
});
