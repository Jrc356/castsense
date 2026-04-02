import type { CastSenseRequestMetadata } from '../types/contracts'

export interface DeviceInfo {
  platform: 'web'
  appVersion: string
  deviceModel: string
  locale: string
  timezone: string
}

export interface LocationData {
  lat: number
  lon: number
  accuracy_m?: number
  altitude_m?: number
  heading_deg?: number
  speed_mps?: number
  timestamp?: number
}

export interface MetadataOptions {
  mode: 'general' | 'specific'
  targetSpecies?: string | null
  platformContext?: 'shore' | 'kayak' | 'boat'
  gearType?: 'spinning' | 'baitcasting' | 'fly' | 'unknown'
  captureType: 'photo'
  captureTimestamp?: Date
  userConstraints?: {
    lures_available?: string[]
    line_test_lb?: number
    notes?: string
  }
  includeLocation?: boolean
}

const APP_VERSION = '1.0.0'
const LOCATION_TIMEOUT_MS = 10000

export function getDeviceInfo(): DeviceInfo {
  return {
    platform: 'web',
    appVersion: APP_VERSION,
    deviceModel: navigator.userAgent,
    locale: navigator.language || 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }
}

export async function getCurrentLocation(): Promise<LocationData | null> {
  if (!navigator.geolocation) {
    return null
  }

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          altitude_m: position.coords.altitude ?? undefined,
          heading_deg: position.coords.heading ?? undefined,
          speed_mps: position.coords.speed ?? undefined,
          timestamp: position.timestamp,
        })
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: LOCATION_TIMEOUT_MS,
        maximumAge: 30000,
      },
    )
  })
}

export interface ExifMetadata {
  location?: {
    latitude: number
    longitude: number
    altitude?: number
  }
  timestamp?: Date
}

export function extractExifMetadata(exifData: ExifMetadata | undefined): {
  location: LocationData | null
  timestamp: Date | null
} {
  if (!exifData) {
    return { location: null, timestamp: null }
  }

  const location = exifData.location
    ? {
        lat: exifData.location.latitude,
        lon: exifData.location.longitude,
        altitude_m: exifData.location.altitude,
      }
    : null

  return {
    location,
    timestamp: exifData.timestamp ?? null,
  }
}

export function watchLocation(
  onUpdate: (location: LocationData) => void,
  onError?: (error: GeolocationPositionError) => void,
): () => void {
  if (!navigator.geolocation) {
    return () => undefined
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onUpdate({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
        altitude_m: position.coords.altitude ?? undefined,
        heading_deg: position.coords.heading ?? undefined,
        speed_mps: position.coords.speed ?? undefined,
        timestamp: position.timestamp,
      })
    },
    (error) => onError?.(error),
    {
      enableHighAccuracy: true,
      timeout: LOCATION_TIMEOUT_MS,
      maximumAge: 30000,
    },
  )

  return () => navigator.geolocation.clearWatch(watchId)
}

export async function collectMetadata(options: MetadataOptions): Promise<CastSenseRequestMetadata> {
  const deviceInfo = getDeviceInfo()
  const location = options.includeLocation === false ? null : await getCurrentLocation()
  const captureTimestamp = options.captureTimestamp || new Date()

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
  }

  if (location) {
    metadata.location = {
      lat: location.lat,
      lon: location.lon,
      accuracy_m: location.accuracy_m,
      altitude_m: location.altitude_m,
      heading_deg: location.heading_deg,
      speed_mps: location.speed_mps,
    }
  }

  if (options.userConstraints) {
    metadata.user_constraints = {
      lures_available: options.userConstraints.lures_available,
      line_test_lb: options.userConstraints.line_test_lb,
      notes: options.userConstraints.notes,
    }
  }

  return metadata
}

export function validateMetadata(metadata: CastSenseRequestMetadata): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!metadata.client.platform) errors.push('Missing client.platform')
  if (!metadata.client.app_version) errors.push('Missing client.app_version')
  if (!metadata.request.mode) errors.push('Missing request.mode')
  if (!metadata.request.capture_type) errors.push('Missing request.capture_type')
  if (!metadata.request.capture_timestamp_utc) {
    errors.push('Missing request.capture_timestamp_utc')
  }

  if (metadata.request.mode === 'specific' && !metadata.request.target_species) {
    errors.push('Missing request.target_species for specific mode')
  }

  if (metadata.location) {
    if (metadata.location.lat < -90 || metadata.location.lat > 90) {
      errors.push('Invalid location.lat')
    }
    if (metadata.location.lon < -180 || metadata.location.lon > 180) {
      errors.push('Invalid location.lon')
    }
  }

  return { valid: errors.length === 0, errors }
}

export function formatLocation(location: LocationData | null): string {
  if (!location) {
    return 'Location unavailable'
  }

  const lat = location.lat.toFixed(4)
  const lon = location.lon.toFixed(4)
  const accuracy = location.accuracy_m ? ` (+/-${Math.round(location.accuracy_m)}m)` : ''

  return `${lat}, ${lon}${accuracy}`
}

export function isLocationAccurate(
  location: LocationData | null,
  maxAccuracyMeters: number = 100,
): boolean {
  if (!location) return false
  if (!location.accuracy_m) return true
  return location.accuracy_m <= maxAccuracyMeters
}

export function getSeason(date: Date, latitude: number): 'winter' | 'spring' | 'summer' | 'fall' {
  const month = date.getMonth()
  const northern: Array<'winter' | 'spring' | 'summer' | 'fall'> = [
    'winter',
    'winter',
    'spring',
    'spring',
    'spring',
    'summer',
    'summer',
    'summer',
    'fall',
    'fall',
    'fall',
    'winter',
  ]

  const season = northern[month] ?? 'summer'

  if (latitude >= 0) {
    return season
  }

  const flip: Record<'winter' | 'spring' | 'summer' | 'fall', 'winter' | 'spring' | 'summer' | 'fall'> = {
    winter: 'summer',
    spring: 'fall',
    summer: 'winter',
    fall: 'spring',
  }

  return flip[season]
}
