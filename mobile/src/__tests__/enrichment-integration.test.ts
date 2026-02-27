/**
 * Enrichment Integration Test
 * 
 * Verifies that enrichment data flows correctly from services through
 * LangChain components to the final prompt.
 * 
 * This test demonstrates Task 8: Integrate with enrichment
 */

import { buildContextPack, formatAnalysisPrompt } from '../services/langchain-prompts';
import type { EnrichmentResults } from '../services/enrichment';

describe('Task 8: Enrichment Integration', () => {
  it('should flow enrichment data through full LangChain pipeline', async () => {
    // Simulate enrichment service output
    const enrichmentData: EnrichmentResults = {
      reverseGeocode: {
        waterbody_name: 'Devil\'s Lake',
        water_type: 'lake',
        admin_area: 'Sauk County',
        country: 'USA'
      },
      weather: {
        temperature_f: 65,
        wind_speed_mph: 12,
        wind_direction_deg: 315,
        cloud_cover_pct: 60,
        pressure_inhg: 29.8,
        pressure_trend: 'falling',
        precip_24h_in: 0.25
      },
      solar: {
        sunrise_local: '06:45',
        sunset_local: '19:15',
        season: 'fall',
        daylight_phase: 'golden_hour'
      }
    };

    const location = { lat: 43.4217, lon: -89.7315 };
    const options = { 
      mode: 'specific' as const,
      targetSpecies: 'Northern Pike',
      platform: 'shore' as const,
      gearType: 'spinning' as const
    };

    // Step 1: Transform enrichment to context pack
    const contextPack = buildContextPack(enrichmentData, location, options);

    // Verify location data transformation
    expect(contextPack.location).toBeDefined();
    expect(contextPack.location?.waterbody_name).toBe('Devil\'s Lake');
    expect(contextPack.location?.water_type).toBe('lake');
    expect(contextPack.location?.lat).toBe(43.4217);
    expect(contextPack.location?.lon).toBe(-89.7315);

    // Verify weather data transformation
    expect(contextPack.weather).toBeDefined();
    expect(contextPack.weather?.air_temp_f).toBe(65);
    expect(contextPack.weather?.wind_speed_mph).toBe(12);
    expect(contextPack.weather?.wind_direction_deg).toBe(315);
    expect(contextPack.weather?.pressure_trend).toBe('falling');

    // Verify time/solar data transformation
    expect(contextPack.time).toBeDefined();
    expect(contextPack.time?.season).toBe('fall');
    expect(contextPack.time?.daylight_phase).toBe('golden_hour');
    expect(contextPack.time?.sunrise_local).toBe('06:45');

    // Verify mode and analysis options
    expect(contextPack.mode).toBe('specific');
    expect(contextPack.target_species).toBe('Northern Pike');
    expect(contextPack.user_context?.platform).toBe('shore');
    expect(contextPack.user_context?.gear_type).toBe('spinning');

    // Step 2: FormatPrompt with context pack
    const promptText = await formatAnalysisPrompt(contextPack);

    // Verify enrichment data appears in prompt
    expect(promptText).toContain('Devil\'s Lake');
    expect(promptText).toContain('lake');
    expect(promptText).toContain('Sauk County');
    expect(promptText).toContain('65°F');
    expect(promptText).toContain('12 mph');
    expect(promptText).toContain('315°'); // Wind direction
    expect(promptText).toContain('falling'); // Pressure trend
    expect(promptText).toContain('fall'); // Season
    expect(promptText).toContain('golden_hour'); // Daylight phase
    expect(promptText).toContain('Northern Pike'); // Target species
    expect(promptText).toContain('specific'); // Mode

    // Verify prompt structure
    expect(promptText).toContain('LOCATION:');
    expect(promptText).toContain('WEATHER:');
    expect(promptText).toContain('TIME:');
    expect(promptText).toContain('MODE:');
  });

  it('should handle degraded enrichment (partial failures)', async () => {
    // Simulate partial enrichment failure (weather service timed out)
    const partialEnrichment: EnrichmentResults = {
      reverseGeocode: {
        waterbody_name: 'Clear Creek',
        water_type: 'river',
        admin_area: null,
        country: null
      },
      weather: null, // Service timeout
      solar: {
        sunrise_local: '07:00',
        sunset_local: '18:30',
        season: 'spring',
        daylight_phase: 'day'
      }
    };

    const location = { lat: 45.0, lon: -93.0 };
    const options = { mode: 'general' as const };

    // Step 1: Build context pack
    const contextPack = buildContextPack(partialEnrichment, location, options);

    // Should have location and time, but no weather
    expect(contextPack.location).toBeDefined();
    expect(contextPack.time).toBeDefined();
    expect(contextPack.weather).toBeUndefined();

    // Step 2: Format prompt
    const promptText = await formatAnalysisPrompt(contextPack);

    // Should still generate valid prompt
    expect(promptText).toContain('Clear Creek');
    expect(promptText).toContain('river');
    expect(promptText).toContain('spring');
    expect(promptText).not.toContain('WEATHER:'); // Section omitted when no data
    expect(promptText).toContain('TIME:');
  });

  it('should handle complete enrichment failure (all null)', async () => {
    // Simulate complete enrichment failure
    const noEnrichment: EnrichmentResults = {
      reverseGeocode: null,
      weather: null,
      solar: null
    };

    const location = { lat: 0, lon: 0 };
    const options = { mode: 'general' as const };

    // Step 1: Build context pack
    const contextPack = buildContextPack(noEnrichment, location, options);

    // Should only have mode
    expect(contextPack.mode).toBe('general');
    expect(contextPack.location).toBeUndefined();
    expect(contextPack.weather).toBeUndefined();
    expect(contextPack.time).toBeUndefined();

    // Step 2: Format prompt
    const promptText = await formatAnalysisPrompt(contextPack);

    // Should still generate minimal valid prompt
    expect(promptText).toBeDefined();
    expect(promptText).toContain('MODE: general');
    expect(promptText).not.toContain('LOCATION:');
    expect(promptText).not.toContain('WEATHER:');
    expect(promptText).not.toContain('TIME:');
  });

  it('should preserve enrichment data types and precision', async () => {
    // Test with precise values
    const preciseEnrichment: EnrichmentResults = {
      reverseGeocode: {
        waterbody_name: 'Test Lake',
        water_type: 'lake',
        admin_area: 'Test Area',
        country: 'USA'
      },
      weather: {
        temperature_f: 72.5,
        wind_speed_mph: 8.3,
        wind_direction_deg: 247,
        cloud_cover_pct: 33,
        pressure_inhg: 30.12,
        pressure_trend: 'steady',
        precip_24h_in: 0.03
      },
      solar: null
    };

    const location = { lat: 42.123456, lon: -88.987654 };
    const options = { mode: 'general' as const };

    const contextPack = buildContextPack(preciseEnrichment, location, options);

    // Verify precise values are preserved
    expect(contextPack.weather?.air_temp_f).toBe(72.5);
    expect(contextPack.weather?.wind_speed_mph).toBe(8.3);
    expect(contextPack.weather?.pressure_inhg).toBe(30.12);
    expect(contextPack.weather?.precip_last_24h_in).toBe(0.03);
    expect(contextPack.location?.lat).toBe(42.123456);
    expect(contextPack.location?.lon).toBe(-88.987654);
  });
});
