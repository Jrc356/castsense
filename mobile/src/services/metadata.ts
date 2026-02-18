/**
 * CastSense Metadata Collection Service (Expo)
 * 
 * Collects all metadata per spec §7.2:
 * - client: platform, app_version, device_model, locale, timezone
 * - request: mode, target_species, platform_context, gear_type, capture_type, timestamp_utc
 * - location: lat, lon, accuracy, altitude, heading, speed
 * - user_constraints: lures_available, line_test_lb, notes
 */

import {Platform} from 'react-native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';
import {
  type CastSenseRequestMetadata,
} from '../types/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  platform: 'ios' | 'android';
  appVersion: string;
  deviceModel: string;
  locale: string;
  timezone: string;
}

export interface LocationData {
  lat: number;
  lon: number;
  accuracy_m?: number;
  altitude_m?: number;
  heading_deg?: number;
  speed_mps?: number;
  timestamp?: number;
}

export interface MetadataOptions {
  mode: 'general' | 'specific';
  targetSpecies?: string | null;
  platformContext?: 'shore' | 'kayak' | 'boat';
  gearType?: 'spinning' | 'baitcasting' | 'fly' | 'unknown';
  captureType: 'photo' | 'video';
  captureTimestamp?: Date;
  userConstraints?: {
    lures_available?: string[];
    line_test_lb?: number;
    notes?: string;
  };
  includeLocation?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// App version - in production, this would come from app config
const APP_VERSION = '1.0.0';

// Location request timeout
const LOCATION_TIMEOUT_MS = 10000;
const LOCATION_MAX_AGE_MS = 30000;

// ─────────────────────────────────────────────────────────────────────────────
// Device Info
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get device information
 */
export function getDeviceInfo(): DeviceInfo {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  
  // Get device model using expo-device
  const deviceModel = Device.modelName || Device.deviceName || 'Unknown Device';

  // Get locale using expo-localization
  const locales = Localization.getLocales();
  const locale = locales[0]?.languageTag || 'en-US';
  
  // Get timezone using expo-localization
  const timezone = Localization.getCalendars()[0]?.timeZone || 'UTC';

  return {
    platform,
    appVersion: APP_VERSION,
    deviceModel,
    locale,
    timezone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Location
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current location
 * Returns null if location is unavailable or denied
 */
export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: LOCATION_TIMEOUT_MS,
      distanceInterval: 0,
    });

    return {
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      accuracy_m: location.coords.accuracy ?? undefined,
      altitude_m: location.coords.altitude ?? undefined,
      heading_deg: location.coords.heading ?? undefined,
      speed_mps: location.coords.speed ?? undefined,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.warn('Location error:', error);
    return null;
  }
}

/**
 * Watch location for continuous updates
 * Returns a cleanup function to stop watching
 */
export function watchLocation(
  onUpdate: (location: LocationData) => void,
  onError?: (error: any) => void
): () => void {
  let subscription: Location.LocationSubscription | null = null;

  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // Update every 5 seconds
      distanceInterval: 10, // Update every 10 meters
    },
    (location) => {
      onUpdate({
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy_m: location.coords.accuracy ?? undefined,
        altitude_m: location.coords.altitude ?? undefined,
        heading_deg: location.coords.heading ?? undefined,
        speed_mps: location.coords.speed ?? undefined,
        timestamp: location.timestamp,
      });
    }
  ).then((sub) => {
    subscription = sub;
  }).catch((error) => {
    console.warn('Location watch error:', error);
    onError?.(error);
  });

  return () => {
    if (subscription) {
      subscription.remove();
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Collection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all metadata for an analysis request
 */
export async function collectMetadata(
  options: MetadataOptions
): Promise<CastSenseRequestMetadata> {
  const deviceInfo = getDeviceInfo();
  const location = options.includeLocation !== false 
    ? await getCurrentLocation() 
    : null;
  
  const captureTimestamp = options.captureTimestamp || new Date();

  const metadata: CastSenseRequestMetadata = {
    client: {
      platform: deviceInfo.platform,
      app_version: deviceInfo.appVersion,
      device_model: deviceInfo.deviceModel,
      locale: deviceInfo.locale,
      timezone: deviceInfo.timezone,
    },
    request: {
      mode: options.mode,
      target_species: options.targetSpecies ?? undefined,
      platform_context: options.platformContext,
      gear_type: options.gearType ?? 'unknown',
      capture_type: options.captureType,
      capture_timestamp_utc: captureTimestamp.toISOString(),
    },
  };

  // Add location if available
  if (location) {
    metadata.location = {
      lat: location.lat,
      lon: location.lon,
      accuracy_m: location.accuracy_m,
      altitude_m: location.altitude_m,
      heading_deg: location.heading_deg,
      speed_mps: location.speed_mps,
    };
  }

  // Add user constraints if provided
  if (options.userConstraints) {
    metadata.user_constraints = {
      lures_available: options.userConstraints.lures_available,
      line_test_lb: options.userConstraints.line_test_lb,
      notes: options.userConstraints.notes,
    };
  }

  return metadata;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that required metadata fields are present
 */
export function validateMetadata(
  metadata: CastSenseRequestMetadata
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required client fields
  if (!metadata.client.platform) {
    errors.push('Missing client.platform');
  }
  if (!metadata.client.app_version) {
    errors.push('Missing client.app_version');
  }

  // Check required request fields
  if (!metadata.request.mode) {
    errors.push('Missing request.mode');
  }
  if (!metadata.request.capture_type) {
    errors.push('Missing request.capture_type');
  }
  if (!metadata.request.capture_timestamp_utc) {
    errors.push('Missing request.capture_timestamp_utc');
  }

  // Validate mode-specific fields
  if (metadata.request.mode === 'specific' && !metadata.request.target_species) {
    errors.push('Missing request.target_species for specific mode');
  }

  // Validate location coordinates if location is present
  if (metadata.location) {
    if (typeof metadata.location.lat !== 'number' || 
        metadata.location.lat < -90 || 
        metadata.location.lat > 90) {
      errors.push('Invalid location.lat');
    }
    if (typeof metadata.location.lon !== 'number' || 
        metadata.location.lon < -180 || 
        metadata.location.lon > 180) {
      errors.push('Invalid location.lon');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format location for display
 */
export function formatLocation(location: LocationData | null): string {
  if (!location) {
    return 'Location unavailable';
  }
  
  const lat = location.lat.toFixed(4);
  const lon = location.lon.toFixed(4);
  const accuracy = location.accuracy_m 
    ? ` (±${Math.round(location.accuracy_m)}m)` 
    : '';
  
  return `${lat}, ${lon}${accuracy}`;
}

/**
 * Check if location is accurate enough for enrichment
 */
export function isLocationAccurate(
  location: LocationData | null,
  maxAccuracyMeters: number = 100
): boolean {
  if (!location) return false;
  if (!location.accuracy_m) return true; // Assume accurate if no accuracy info
  return location.accuracy_m <= maxAccuracyMeters;
}

/**
 * Get simple season from date and hemisphere
 */
export function getSeason(
  date: Date,
  latitude: number
): 'winter' | 'spring' | 'summer' | 'fall' {
  const month = date.getMonth(); // 0-11
  const isNorthernHemisphere = latitude >= 0;

  // Northern hemisphere seasons
  const seasons: Array<'winter' | 'spring' | 'summer' | 'fall'> = [
    'winter', 'winter', // Jan, Feb
    'spring', 'spring', 'spring', // Mar, Apr, May
    'summer', 'summer', 'summer', // Jun, Jul, Aug
    'fall', 'fall', 'fall', // Sep, Oct, Nov
    'winter', // Dec
  ];

  const season = seasons[month];
  
  // Flip for southern hemisphere
  if (!isNorthernHemisphere) {
    const flip: Record<typeof season, typeof season> = {
      winter: 'summer',
      spring: 'fall',
      summer: 'winter',
      fall: 'spring',
    };
    return flip[season];
  }

  return season;
}
