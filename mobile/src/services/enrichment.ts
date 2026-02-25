/**
 * Enrichment Service (Mobile)
 * 
 * Provides geocoding, weather, and solar enrichment for analysis context.
 * Runs all enrichments in parallel with 2s timeout per task.
 */

import SunCalc from 'suncalc';

const ENRICHMENT_TIMEOUT_MS = 2000;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// ============================================================================
// Types
// ============================================================================

export interface ReverseGeocodeResult {
  waterbody_name: string | null;
  water_type: 'lake' | 'river' | 'pond' | 'ocean' | 'unknown';
  admin_area: string | null;
  country: string | null;
}

export interface WeatherResult {
  temperature_f: number;
  wind_speed_mph: number;
  wind_direction_deg: number;
  cloud_cover_pct: number;
  pressure_inhg: number;
  pressure_trend: 'rising' | 'steady' | 'falling' | 'unknown';
  precip_24h_in: number;
}

export interface SolarResult {
  sunrise_local: string; // HH:MM format
  sunset_local: string; // HH:MM format
  daylight_phase: 'pre_dawn' | 'sunrise' | 'day' | 'golden_hour' | 'sunset' | 'after_sunset' | 'night';
  season: 'winter' | 'spring' | 'summer' | 'fall';
}

export interface EnrichmentResults {
  reverseGeocode: ReverseGeocodeResult | null;
  weather: WeatherResult | null;
  solar: SolarResult | null;
}

export interface EnrichmentStatus {
  reverse_geocode: 'ok' | 'failed' | 'skipped';
  weather: 'ok' | 'failed' | 'skipped';
  solar: 'ok' | 'failed' | 'skipped';
}

export interface EnrichmentResult {
  results: EnrichmentResults;
  status: EnrichmentStatus;
  overallStatus: 'ok' | 'degraded';
}

// ============================================================================
// Reverse Geocode
// ============================================================================

interface NominatimAddress {
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
}

interface NominatimResponse {
  address?: NominatimAddress;
  type?: string;
  category?: string;
  extratags?: {
    water?: string;
    natural?: string;
  };
}

function determineWaterType(response: NominatimResponse): ReverseGeocodeResult['water_type'] {
  const address = response.address || {};
  const extratags = response.extratags || {};

  if (address.ocean || address.sea) return 'ocean';
  if (address.lake) return 'lake';
  if (address.river) return 'river';
  if (address.pond) return 'pond';

  const type = response.type?.toLowerCase() || '';
  if (type === 'ocean' || type === 'sea') return 'ocean';
  if (type === 'lake' || type === 'reservoir') return 'lake';
  if (type === 'river' || type === 'stream' || type === 'creek') return 'river';
  if (type === 'pond') return 'pond';

  const natural = extratags.natural?.toLowerCase() || '';
  if (natural === 'water') {
    const waterTag = extratags.water?.toLowerCase() || '';
    if (waterTag === 'lake' || waterTag === 'reservoir') return 'lake';
    if (waterTag === 'river' || waterTag === 'stream') return 'river';
    if (waterTag === 'pond') return 'pond';
    if (waterTag === 'ocean' || waterTag === 'sea') return 'ocean';
  }

  return 'unknown';
}

function extractWaterbodyName(response: NominatimResponse): string | null {
  const address = response.address || {};
  return address.water || address.lake || address.river || address.pond || 
         address.bay || address.ocean || address.sea || null;
}

function extractAdminArea(response: NominatimResponse): string | null {
  const address = response.address || {};
  return address.state || address.county || address.city || 
         address.town || address.village || null;
}

async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=json&addressdetails=1&extratags=1&zoom=14`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENRICHMENT_TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'CastSense/1.0 (https://castsense.app)',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('[Enrichment] Nominatim API error:', response.status);
      return null;
    }

    const data: NominatimResponse = await response.json();

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
  } catch (error) {
    console.warn('[Enrichment] Reverse geocode failed:', error);
    return null;
  }
}

// ============================================================================
// Weather
// ============================================================================

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    cloud_cover?: number;
    surface_pressure?: number;
    precipitation?: number;
  };
  hourly?: {
    time?: string[];
    precipitation?: number[];
    surface_pressure?: number[];
  };
}

function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

function hpaToInhg(hpa: number): number {
  return Math.round(hpa * 0.02953 * 100) / 100;
}

function mmToInches(mm: number): number {
  return Math.round(mm * 0.0393701 * 100) / 100;
}

function calculatePressureTrend(
  hourlyPressure: number[],
  hourlyTimes: string[],
  currentTime: string
): WeatherResult['pressure_trend'] {
  if (!hourlyPressure || hourlyPressure.length < 4) {
    return 'unknown';
  }

  const currentIndex = hourlyTimes.findIndex((t) => t === currentTime);
  if (currentIndex < 3) return 'unknown';

  const pressureNow = hourlyPressure[currentIndex];
  const pressure3hAgo = hourlyPressure[currentIndex - 3];

  if (pressureNow === undefined || pressure3hAgo === undefined) {
    return 'unknown';
  }

  const diff = pressureNow - pressure3hAgo;
  if (diff > 1) return 'rising';
  if (diff < -1) return 'falling';
  return 'steady';
}

function calculatePrecipLast24h(
  hourlyPrecip: number[],
  hourlyTimes: string[],
  currentTime: string
): number {
  if (!hourlyPrecip || hourlyPrecip.length < 24) return 0;

  const currentIndex = hourlyTimes.findIndex((t) => t === currentTime);
  if (currentIndex < 23) {
    const startIndex = Math.max(0, currentIndex - 23);
    return hourlyPrecip.slice(startIndex, currentIndex + 1).reduce((a, b) => a + (b || 0), 0);
  }

  return hourlyPrecip.slice(currentIndex - 23, currentIndex + 1).reduce((a, b) => a + (b || 0), 0);
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherResult | null> {
  try {
    const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,surface_pressure,precipitation&hourly=precipitation,surface_pressure&past_days=1&forecast_days=1&timezone=auto`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENRICHMENT_TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('[Enrichment] Open-Meteo API error:', response.status);
      return null;
    }

    const data: OpenMeteoResponse = await response.json();

    if (!data.current) {
      console.warn('[Enrichment] No current weather data');
      return null;
    }

    const current = data.current;
    const hourly = data.hourly || {};

    const pressureTrend = calculatePressureTrend(
      hourly.surface_pressure || [],
      hourly.time || [],
      current.time || ''
    );

    const precip24h = calculatePrecipLast24h(
      hourly.precipitation || [],
      hourly.time || [],
      current.time || ''
    );

    return {
      temperature_f: celsiusToFahrenheit(current.temperature_2m || 0),
      wind_speed_mph: kmhToMph(current.wind_speed_10m || 0),
      wind_direction_deg: current.wind_direction_10m || 0,
      cloud_cover_pct: current.cloud_cover || 0,
      pressure_inhg: hpaToInhg(current.surface_pressure || 1013),
      pressure_trend: pressureTrend,
      precip_24h_in: mmToInches(precip24h)
    };
  } catch (error) {
    console.warn('[Enrichment] Weather fetch failed:', error);
    return null;
  }
}

// ============================================================================
// Solar
// ============================================================================

function formatTimeLocal(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone
    });
    return formatter.format(date);
  } catch {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

function determineDaylightPhase(
  timestamp: Date,
  sunTimes: SunCalc.GetTimesResult
): SolarResult['daylight_phase'] {
  const now = timestamp.getTime();
  const sunrise = sunTimes.sunrise?.getTime() || 0;
  const sunset = sunTimes.sunset?.getTime() || 0;
  const dawn = sunTimes.dawn?.getTime() || 0;
  const dusk = sunTimes.dusk?.getTime() || 0;
  const goldenHourStart = sunTimes.goldenHour?.getTime() || 0;
  const goldenHourEnd = sunTimes.goldenHourEnd?.getTime() || 0;

  if (!sunrise || !sunset) {
    const hour = timestamp.getHours();
    return hour >= 6 && hour < 18 ? 'day' : 'night';
  }

  const thirtyMinutes = 30 * 60 * 1000;

  if (now < dawn) return 'pre_dawn';
  if (now < sunrise + thirtyMinutes) return 'sunrise';
  if (goldenHourEnd && now < goldenHourEnd) return 'day';
  if (goldenHourStart && now >= goldenHourStart && now < sunset - thirtyMinutes) return 'golden_hour';
  if (now >= sunset - thirtyMinutes && now < sunset + thirtyMinutes) return 'sunset';
  if (now >= sunset + thirtyMinutes && now < dusk) return 'after_sunset';
  if (now >= dusk) return 'night';
  return 'day';
}

function determineSeason(lat: number, timestamp: Date, timezone: string): SolarResult['season'] {
  let month: number;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      timeZone: timezone
    });
    month = parseInt(formatter.format(timestamp), 10);
  } catch {
    month = timestamp.getMonth() + 1;
  }

  const northernSeasons: Record<number, SolarResult['season']> = {
    12: 'winter', 1: 'winter', 2: 'winter',
    3: 'spring', 4: 'spring', 5: 'spring',
    6: 'summer', 7: 'summer', 8: 'summer',
    9: 'fall', 10: 'fall', 11: 'fall'
  };

  const southernSeasons: Record<number, SolarResult['season']> = {
    12: 'summer', 1: 'summer', 2: 'summer',
    3: 'fall', 4: 'fall', 5: 'fall',
    6: 'winter', 7: 'winter', 8: 'winter',
    9: 'spring', 10: 'spring', 11: 'spring'
  };

  return lat >= 0 
    ? (northernSeasons[month] || 'spring')
    : (southernSeasons[month] || 'fall');
}

function calculateSolar(
  lat: number,
  lon: number,
  timestamp: Date,
  timezone: string
): SolarResult {
  const sunTimes = SunCalc.getTimes(timestamp, lat, lon);

  return {
    sunrise_local: formatTimeLocal(sunTimes.sunrise, timezone),
    sunset_local: formatTimeLocal(sunTimes.sunset, timezone),
    daylight_phase: determineDaylightPhase(timestamp, sunTimes),
    season: determineSeason(lat, timestamp, timezone)
  };
}

// ============================================================================
// Orchestrator
// ============================================================================

export interface Location {
  lat: number;
  lon: number;
}

/**
 * Run all enrichments in parallel with timeouts
 * 
 * @param location - GPS coordinates
 * @param timestamp - Capture timestamp
 * @param timezone - IANA timezone identifier
 * @returns Enrichment results and status
 */
export async function enrichMetadata(
  location: Location,
  timestamp: Date = new Date(),
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): Promise<EnrichmentResult> {
  const results: EnrichmentResults = {
    reverseGeocode: null,
    weather: null,
    solar: null
  };

  const status: EnrichmentStatus = {
    reverse_geocode: 'skipped',
    weather: 'skipped',
    solar: 'skipped'
  };

  const { lat, lon } = location;

  // Validate coordinates
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    console.warn('[Enrichment] Invalid coordinates:', { lat, lon });
    return { results, status, overallStatus: 'degraded' };
  }

  // Run enrichments in parallel
  const [geocodeResult, weatherResult, solarResult] = await Promise.allSettled([
    reverseGeocode(lat, lon),
    fetchWeather(lat, lon),
    Promise.resolve(calculateSolar(lat, lon, timestamp, timezone))
  ]);

  // Process reverse geocode
  if (geocodeResult.status === 'fulfilled' && geocodeResult.value) {
    results.reverseGeocode = geocodeResult.value;
    status.reverse_geocode = 'ok';
  } else {
    status.reverse_geocode = 'failed';
  }

  // Process weather
  if (weatherResult.status === 'fulfilled' && weatherResult.value) {
    results.weather = weatherResult.value;
    status.weather = 'ok';
  } else {
    status.weather = 'failed';
  }

  // Process solar (should never fail)
  if (solarResult.status === 'fulfilled') {
    results.solar = solarResult.value;
    status.solar = 'ok';
  } else {
    status.solar = 'failed';
  }

  const anyFailed = [
    status.reverse_geocode,
    status.weather,
    status.solar
  ].some((s) => s === 'failed');

  return {
    results,
    status,
    overallStatus: anyFailed ? 'degraded' : 'ok'
  };
}
