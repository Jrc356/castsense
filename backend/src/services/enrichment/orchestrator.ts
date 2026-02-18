/**
 * Enrichment Orchestrator (T3.5)
 * 
 * Runs all enrichment providers in parallel with soft timeouts
 */

import { 
  EnrichmentResults, 
  EnrichmentStatusMap,
  EnrichmentStatus,
  isEnrichmentError,
  ReverseGeocodeResult,
  WeatherResult,
  SolarResult
} from '../../types/enrichment';
import { reverseGeocode } from './reverse-geocode';
import { fetchWeather } from './weather';
import { calculateSolar } from './solar';

/**
 * Result from the enrichment orchestrator
 */
export interface EnrichmentOrchestrationResult {
  results: EnrichmentResults;
  status: EnrichmentStatusMap;
  overallStatus: 'ok' | 'degraded';
}

/**
 * Run all enrichment providers in parallel
 * 
 * Uses Promise.allSettled to ensure all providers complete (or timeout)
 * even if one fails. Each provider has its own soft timeout.
 * 
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @param timestamp - The capture/request timestamp
 * @param timezone - IANA timezone identifier
 * @returns Aggregated enrichment results and status map
 */
export async function runEnrichments(
  lat: number,
  lon: number,
  timestamp: Date,
  timezone: string
): Promise<EnrichmentOrchestrationResult> {
  // Initialize results and status
  const results: EnrichmentResults = {
    reverseGeocode: null,
    weather: null,
    solar: null,
    hydrology: null
  };

  const status: EnrichmentStatusMap = {
    reverse_geocode: 'skipped',
    weather: 'skipped',
    solar: 'skipped',
    hydrology: 'skipped'
  };

  // Run enrichments in parallel
  const [
    reverseGeocodeResult,
    weatherResult,
    solarResult
  ] = await Promise.allSettled([
    reverseGeocode(lat, lon),
    fetchWeather(lat, lon),
    // Solar is synchronous but wrapped in Promise for consistency
    Promise.resolve(calculateSolar(lat, lon, timestamp, timezone))
  ]);

  // Process reverse geocode result
  if (reverseGeocodeResult.status === 'fulfilled') {
    const value = reverseGeocodeResult.value;
    if (isEnrichmentError(value)) {
      status.reverse_geocode = 'failed';
      // Log error but don't throw - best effort
      console.warn('Reverse geocode enrichment failed:', value.error);
    } else {
      results.reverseGeocode = value as ReverseGeocodeResult;
      status.reverse_geocode = 'ok';
    }
  } else {
    status.reverse_geocode = 'failed';
    console.warn('Reverse geocode enrichment rejected:', reverseGeocodeResult.reason);
  }

  // Process weather result
  if (weatherResult.status === 'fulfilled') {
    const value = weatherResult.value;
    if (isEnrichmentError(value)) {
      status.weather = 'failed';
      console.warn('Weather enrichment failed:', value.error);
    } else {
      results.weather = value as WeatherResult;
      status.weather = 'ok';
    }
  } else {
    status.weather = 'failed';
    console.warn('Weather enrichment rejected:', weatherResult.reason);
  }

  // Process solar result (should never fail since it's local compute)
  if (solarResult.status === 'fulfilled') {
    results.solar = solarResult.value as SolarResult;
    status.solar = 'ok';
  } else {
    status.solar = 'failed';
    console.warn('Solar calculation failed:', solarResult.reason);
  }

  // Hydrology is skipped in v1 (no provider implemented)
  status.hydrology = 'skipped';

  // Determine overall status
  const anyFailed = [
    status.reverse_geocode,
    status.weather,
    status.solar
  ].some((s) => s === 'failed');

  const overallStatus = anyFailed ? 'degraded' : 'ok';

  return {
    results,
    status,
    overallStatus
  };
}

/**
 * Check if enrichment can proceed (has valid location)
 */
export function canEnrich(lat?: number, lon?: number): boolean {
  if (lat === undefined || lon === undefined) {
    return false;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return false;
  }
  return true;
}

export default runEnrichments;
