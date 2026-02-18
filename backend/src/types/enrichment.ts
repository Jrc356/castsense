/**
 * Enrichment Types
 * 
 * Types for context enrichment modules (T3.x)
 */

/**
 * Error result from an enrichment provider
 */
export interface EnrichmentError {
  provider: string;
  error: string;
  retryable: boolean;
}

/**
 * Result from reverse geocoding
 */
export interface ReverseGeocodeResult {
  waterbody_name: string | null;
  water_type: 'lake' | 'river' | 'pond' | 'ocean' | 'unknown';
  admin_area: string | null;
  country: string | null;
}

/**
 * Result from weather provider
 */
export interface WeatherResult {
  air_temp_f: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
  cloud_cover_pct: number;
  precip_last_24h_in: number;
  pressure_inhg: number;
  pressure_trend: 'rising' | 'steady' | 'falling' | 'unknown';
}

/**
 * Result from solar calculations
 */
export interface SolarResult {
  sunrise_local: string;
  sunset_local: string;
  daylight_phase: 'pre_dawn' | 'sunrise' | 'day' | 'golden_hour' | 'sunset' | 'after_sunset' | 'night';
  season: 'winter' | 'spring' | 'summer' | 'fall';
}

/**
 * Optional hydrology result (for future use)
 */
export interface HydrologyResult {
  flow_cfs: number;
  gauge_height_ft: number;
  source: string | null;
  observed_at_utc: string | null;
}

/**
 * Aggregated enrichment results
 */
export interface EnrichmentResults {
  reverseGeocode?: ReverseGeocodeResult | null;
  weather?: WeatherResult | null;
  solar?: SolarResult | null;
  hydrology?: HydrologyResult | null;
}

/**
 * Status of an individual enrichment provider
 */
export type EnrichmentStatus = 'ok' | 'failed' | 'skipped';

/**
 * Status map for all enrichment providers
 */
export interface EnrichmentStatusMap {
  reverse_geocode: EnrichmentStatus;
  weather: EnrichmentStatus;
  solar: EnrichmentStatus;
  hydrology: EnrichmentStatus;
}

/**
 * Type guard to check if a result is an error
 */
export function isEnrichmentError(result: unknown): result is EnrichmentError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'provider' in result &&
    'error' in result &&
    'retryable' in result
  );
}

/**
 * Context pack per spec §8 - canonical context passed to AI and returned for transparency
 */
export interface ContextPack {
  mode: 'general' | 'specific';
  target_species: string | null;
  user_context: {
    platform?: 'shore' | 'kayak' | 'boat';
    gear_type?: 'spinning' | 'baitcasting' | 'fly' | 'unknown';
    constraints?: {
      lures_available?: string[];
      line_test_lb?: number;
      notes?: string;
    };
  };
  location: {
    lat: number;
    lon: number;
    accuracy_m?: number;
    waterbody_name: string | null;
    water_type: 'lake' | 'river' | 'pond' | 'ocean' | 'unknown';
    admin_area: string | null;
    country: string | null;
  };
  time: {
    timestamp_utc: string;
    local_time: string;
    season: 'winter' | 'spring' | 'summer' | 'fall';
    sunrise_local: string;
    sunset_local: string;
    daylight_phase: 'pre_dawn' | 'sunrise' | 'day' | 'golden_hour' | 'sunset' | 'after_sunset' | 'night';
  };
  weather: {
    air_temp_f: number;
    wind_speed_mph: number;
    wind_direction_deg: number;
    cloud_cover_pct: number;
    precip_last_24h_in: number;
    pressure_inhg: number;
    pressure_trend: 'rising' | 'steady' | 'falling' | 'unknown';
  } | null;
  hydrology?: {
    flow_cfs: number;
    gauge_height_ft: number;
    source: string | null;
    observed_at_utc: string | null;
  } | null;
  species_context?: {
    likely_species: Array<{ species: string; confidence: number }>;
    source: 'defaults' | 'dataset' | 'ai_inferred';
  };
}
