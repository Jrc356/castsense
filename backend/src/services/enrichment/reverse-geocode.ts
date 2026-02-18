/**
 * Reverse Geocode Module (T3.2)
 * 
 * Calls Nominatim/OpenStreetMap for reverse geocoding with soft timeout
 */

import { ReverseGeocodeResult, EnrichmentError } from '../../types/enrichment';

// Default timeout from environment
const ENRICHMENT_TIMEOUT_MS = parseInt(process.env.ENRICHMENT_TIMEOUT_MS || '2000', 10);

// Nominatim API endpoint
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Response structure from Nominatim API
 */
interface NominatimResponse {
  place_id?: number;
  display_name?: string;
  address?: {
    water?: string;
    lake?: string;
    river?: string;
    pond?: string;
    bay?: string;
    ocean?: string;
    sea?: string;
    state?: string;
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    country_code?: string;
  };
  type?: string;
  category?: string;
  extratags?: {
    water?: string;
    natural?: string;
  };
}

/**
 * Determine water type from Nominatim response
 */
function determineWaterType(
  response: NominatimResponse
): 'lake' | 'river' | 'pond' | 'ocean' | 'unknown' {
  const address = response.address || {};
  const extratags = response.extratags || {};

  // Check address fields for water types
  if (address.ocean || address.sea) return 'ocean';
  if (address.lake) return 'lake';
  if (address.river) return 'river';
  if (address.pond) return 'pond';

  // Check type/category
  const type = response.type?.toLowerCase() || '';
  const category = response.category?.toLowerCase() || '';

  if (type === 'ocean' || type === 'sea') return 'ocean';
  if (type === 'lake' || type === 'reservoir') return 'lake';
  if (type === 'river' || type === 'stream' || type === 'creek') return 'river';
  if (type === 'pond') return 'pond';

  // Check natural tag
  const natural = extratags.natural?.toLowerCase() || '';
  if (natural === 'water') {
    const waterTag = extratags.water?.toLowerCase() || '';
    if (waterTag === 'lake' || waterTag === 'reservoir') return 'lake';
    if (waterTag === 'river' || waterTag === 'stream' || waterTag === 'creek') return 'river';
    if (waterTag === 'pond') return 'pond';
    if (waterTag === 'ocean' || waterTag === 'sea') return 'ocean';
  }

  // Check if it's a waterway category
  if (category === 'waterway') return 'river';
  if (category === 'natural' && type === 'water') return 'unknown';

  return 'unknown';
}

/**
 * Extract waterbody name from Nominatim response
 */
function extractWaterbodyName(response: NominatimResponse): string | null {
  const address = response.address || {};

  // Check water-specific address fields
  if (address.water) return address.water;
  if (address.lake) return address.lake;
  if (address.river) return address.river;
  if (address.pond) return address.pond;
  if (address.bay) return address.bay;
  if (address.ocean) return address.ocean;
  if (address.sea) return address.sea;

  // No specific waterbody name found
  return null;
}

/**
 * Extract administrative area from Nominatim response
 */
function extractAdminArea(response: NominatimResponse): string | null {
  const address = response.address || {};

  // Prefer state, then county, then city
  if (address.state) return address.state;
  if (address.county) return address.county;
  if (address.city) return address.city;
  if (address.town) return address.town;
  if (address.village) return address.village;

  return null;
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Reverse geocode coordinates using Nominatim
 * 
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns Reverse geocode result or enrichment error
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult | EnrichmentError> {
  const controller = createTimeoutController(ENRICHMENT_TIMEOUT_MS);

  try {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lon.toString());
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('zoom', '14'); // Good balance for water features

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'CastSense/1.0 (https://castsense.app)',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        provider: 'nominatim',
        error: `HTTP ${response.status}: ${response.statusText}`,
        retryable: response.status >= 500
      };
    }

    const data = (await response.json()) as NominatimResponse;

    // Handle case where no result found
    if (!data || !data.address) {
      return {
        waterbody_name: null,
        water_type: 'unknown',
        admin_area: null,
        country: null
      };
    }

    return {
      waterbody_name: extractWaterbodyName(data),
      water_type: determineWaterType(data),
      admin_area: extractAdminArea(data),
      country: data.address.country || null
    };
  } catch (err) {
    const error = err as Error;

    // Handle timeout/abort
    if (error.name === 'AbortError') {
      return {
        provider: 'nominatim',
        error: 'Request timed out',
        retryable: true
      };
    }

    // Handle network errors
    return {
      provider: 'nominatim',
      error: error.message || 'Unknown error',
      retryable: true
    };
  }
}

export default reverseGeocode;
