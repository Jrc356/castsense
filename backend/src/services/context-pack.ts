/**
 * Context Pack Builder (T3.1)
 * 
 * Builds the canonical context pack from metadata and enrichment outputs
 * per spec §8
 */

import { CastSenseRequestMetadata } from '../types/contracts';
import { 
  ContextPack, 
  EnrichmentResults, 
  SolarResult 
} from '../types/enrichment';

/**
 * Format timestamp as local time string (HH:MM)
 */
function formatLocalTime(timestamp: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone
    });
    return formatter.format(timestamp);
  } catch {
    // Fallback if timezone is invalid
    const hours = timestamp.getHours().toString().padStart(2, '0');
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Get default solar result when enrichment is unavailable
 */
function getDefaultSolar(): SolarResult {
  return {
    sunrise_local: '06:00',
    sunset_local: '18:00',
    daylight_phase: 'day',
    season: 'spring'
  };
}

/**
 * Build the canonical context pack from metadata and enrichment results
 * 
 * This is the single source of truth for context passed to AI and returned
 * in the response envelope for transparency.
 * 
 * @param metadata - Client request metadata
 * @param enrichments - Results from enrichment providers
 * @returns Complete context pack
 */
export function buildContextPack(
  metadata: CastSenseRequestMetadata,
  enrichments: EnrichmentResults
): ContextPack {
  const { client, request, location, user_constraints } = metadata;
  
  // Parse capture timestamp
  const captureTimestamp = new Date(request.capture_timestamp_utc);
  const timezone = client.timezone || 'UTC';

  // Get solar data (use enrichment or defaults)
  const solar = enrichments.solar || getDefaultSolar();

  // Build location object
  const locationPack: ContextPack['location'] = {
    lat: location?.lat ?? 0,
    lon: location?.lon ?? 0,
    accuracy_m: location?.accuracy_m,
    waterbody_name: enrichments.reverseGeocode?.waterbody_name ?? null,
    water_type: enrichments.reverseGeocode?.water_type ?? 'unknown',
    admin_area: enrichments.reverseGeocode?.admin_area ?? null,
    country: enrichments.reverseGeocode?.country ?? null
  };

  // Build time object
  const timePack: ContextPack['time'] = {
    timestamp_utc: request.capture_timestamp_utc,
    local_time: formatLocalTime(captureTimestamp, timezone),
    season: solar.season,
    sunrise_local: solar.sunrise_local,
    sunset_local: solar.sunset_local,
    daylight_phase: solar.daylight_phase
  };

  // Build weather object (null if not available)
  const weatherPack: ContextPack['weather'] = enrichments.weather 
    ? {
        air_temp_f: enrichments.weather.air_temp_f,
        wind_speed_mph: enrichments.weather.wind_speed_mph,
        wind_direction_deg: enrichments.weather.wind_direction_deg,
        cloud_cover_pct: enrichments.weather.cloud_cover_pct,
        precip_last_24h_in: enrichments.weather.precip_last_24h_in,
        pressure_inhg: enrichments.weather.pressure_inhg,
        pressure_trend: enrichments.weather.pressure_trend
      }
    : null;

  // Build user context
  const userContextPack: ContextPack['user_context'] = {
    platform: request.platform_context,
    gear_type: request.gear_type,
    constraints: user_constraints 
      ? {
          lures_available: user_constraints.lures_available,
          line_test_lb: user_constraints.line_test_lb,
          notes: user_constraints.notes
        }
      : undefined
  };

  // Build hydrology object (optional, from enrichments)
  const hydrologyPack: ContextPack['hydrology'] = enrichments.hydrology
    ? {
        flow_cfs: enrichments.hydrology.flow_cfs,
        gauge_height_ft: enrichments.hydrology.gauge_height_ft,
        source: enrichments.hydrology.source,
        observed_at_utc: enrichments.hydrology.observed_at_utc
      }
    : null;

  // Assemble the full context pack
  const contextPack: ContextPack = {
    mode: request.mode,
    target_species: request.target_species ?? null,
    user_context: userContextPack,
    location: locationPack,
    time: timePack,
    weather: weatherPack,
    hydrology: hydrologyPack
  };

  // Species context is not populated at enrichment stage
  // It will be filled in by AI inference later
  // contextPack.species_context remains undefined

  return contextPack;
}

/**
 * Merge additional species context into an existing context pack
 * Used after AI inference to add species predictions
 */
export function addSpeciesContext(
  contextPack: ContextPack,
  likelySpecies: Array<{ species: string; confidence: number }>,
  source: 'defaults' | 'dataset' | 'ai_inferred'
): ContextPack {
  return {
    ...contextPack,
    species_context: {
      likely_species: likelySpecies,
      source
    }
  };
}

export default buildContextPack;
