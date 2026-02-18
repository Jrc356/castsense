/**
 * Weather Module (T3.3)
 * 
 * Fetches weather data from Open-Meteo API with soft timeout
 */

import { WeatherResult, EnrichmentError } from '../../types/enrichment';

// Default timeout from environment
const ENRICHMENT_TIMEOUT_MS = parseInt(process.env.ENRICHMENT_TIMEOUT_MS || '2000', 10);

// Open-Meteo API endpoint
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Open-Meteo API response structure
 */
interface OpenMeteoResponse {
  latitude?: number;
  longitude?: number;
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
  error?: boolean;
  reason?: string;
}

/**
 * Convert Celsius to Fahrenheit
 */
function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

/**
 * Convert km/h to mph
 */
function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

/**
 * Convert hPa to inHg
 */
function hpaToInhg(hpa: number): number {
  return Math.round((hpa * 0.02953) * 100) / 100;
}

/**
 * Convert mm to inches
 */
function mmToInches(mm: number): number {
  return Math.round((mm * 0.0393701) * 100) / 100;
}

/**
 * Calculate pressure trend from hourly data
 * Compares last 3 hours of pressure readings
 */
function calculatePressureTrend(
  hourlyPressure: number[],
  hourlyTimes: string[],
  currentTime: string
): 'rising' | 'steady' | 'falling' | 'unknown' {
  if (!hourlyPressure || hourlyPressure.length < 4) {
    return 'unknown';
  }

  // Find current hour index
  const currentIndex = hourlyTimes.findIndex((t) => t === currentTime);
  if (currentIndex < 3) {
    return 'unknown';
  }

  // Get pressure readings from 3 hours ago and now
  const pressureNow = hourlyPressure[currentIndex];
  const pressure3hAgo = hourlyPressure[currentIndex - 3];

  if (pressureNow === undefined || pressure3hAgo === undefined) {
    return 'unknown';
  }

  const diff = pressureNow - pressure3hAgo;

  // Threshold: 1 hPa change over 3 hours is significant
  if (diff > 1) return 'rising';
  if (diff < -1) return 'falling';
  return 'steady';
}

/**
 * Calculate total precipitation in last 24 hours from hourly data
 */
function calculatePrecipLast24h(
  hourlyPrecip: number[],
  hourlyTimes: string[],
  currentTime: string
): number {
  if (!hourlyPrecip || hourlyPrecip.length < 24) {
    return 0;
  }

  // Find current hour index
  const currentIndex = hourlyTimes.findIndex((t) => t === currentTime);
  if (currentIndex < 23) {
    // Not enough historical data, sum what we have
    const startIndex = Math.max(0, currentIndex - 23);
    return hourlyPrecip.slice(startIndex, currentIndex + 1).reduce((a, b) => a + (b || 0), 0);
  }

  // Sum last 24 hours
  return hourlyPrecip.slice(currentIndex - 23, currentIndex + 1).reduce((a, b) => a + (b || 0), 0);
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
 * Fetch weather data for coordinates using Open-Meteo
 * 
 * @param lat - Latitude in decimal degrees
 * @param lon - Longitude in decimal degrees
 * @returns Weather result or enrichment error
 */
export async function fetchWeather(
  lat: number,
  lon: number
): Promise<WeatherResult | EnrichmentError> {
  const controller = createTimeoutController(ENRICHMENT_TIMEOUT_MS);

  try {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set('latitude', lat.toString());
    url.searchParams.set('longitude', lon.toString());
    url.searchParams.set('current', 'temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,surface_pressure,precipitation');
    url.searchParams.set('hourly', 'precipitation,surface_pressure');
    url.searchParams.set('past_days', '1'); // For 24h precipitation
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('timezone', 'auto');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        provider: 'open-meteo',
        error: `HTTP ${response.status}: ${response.statusText}`,
        retryable: response.status >= 500
      };
    }

    const data = (await response.json()) as OpenMeteoResponse;

    // Check for API error
    if (data.error) {
      return {
        provider: 'open-meteo',
        error: data.reason || 'API error',
        retryable: false
      };
    }

    // Check for current data
    if (!data.current) {
      return {
        provider: 'open-meteo',
        error: 'No current weather data available',
        retryable: false
      };
    }

    const current = data.current;
    const hourly = data.hourly || {};

    // Calculate pressure trend and 24h precip
    const pressureTrend = calculatePressureTrend(
      hourly.surface_pressure || [],
      hourly.time || [],
      current.time || ''
    );

    const precipLast24hMm = calculatePrecipLast24h(
      hourly.precipitation || [],
      hourly.time || [],
      current.time || ''
    );

    return {
      air_temp_f: current.temperature_2m !== undefined 
        ? celsiusToFahrenheit(current.temperature_2m) 
        : 0,
      wind_speed_mph: current.wind_speed_10m !== undefined 
        ? kmhToMph(current.wind_speed_10m) 
        : 0,
      wind_direction_deg: current.wind_direction_10m !== undefined 
        ? Math.round(current.wind_direction_10m) 
        : 0,
      cloud_cover_pct: current.cloud_cover !== undefined 
        ? Math.round(current.cloud_cover) 
        : 0,
      precip_last_24h_in: mmToInches(precipLast24hMm),
      pressure_inhg: current.surface_pressure !== undefined 
        ? hpaToInhg(current.surface_pressure) 
        : 29.92,
      pressure_trend: pressureTrend
    };
  } catch (err) {
    const error = err as Error;

    // Handle timeout/abort
    if (error.name === 'AbortError') {
      return {
        provider: 'open-meteo',
        error: 'Request timed out',
        retryable: true
      };
    }

    // Handle network errors
    return {
      provider: 'open-meteo',
      error: error.message || 'Unknown error',
      retryable: true
    };
  }
}

export default fetchWeather;
