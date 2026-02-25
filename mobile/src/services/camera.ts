/**
 * CastSense Camera Service
 * 
 * Handles photo capture using react-native-vision-camera
 * Includes pre-capture configuration for optimal quality
 * 
 * Photo: JPEG format with configurable quality
 */

import {Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PhotoCapture {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes?: number;
}

export interface CameraRef {
  takePictureAsync: (options?: any) => Promise<any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PHOTO_QUALITY = 0.8;

// ─────────────────────────────────────────────────────────────────────────────
// Photo Capture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capture a photo with quality settings
 * Returns JPEG format
 */
export async function capturePhoto(camera: CameraRef): Promise<PhotoCapture> {
  try {
    // Take photo with quality settings
    const photo = await camera.takePictureAsync({
      quality: PHOTO_QUALITY,
      base64: false,
      skipProcessing: false,
    });

    // Get dimensions
    const width = photo.width || 0;
    const height = photo.height || 0;

    return {
      uri: photo.uri,
      width,
      height,
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    console.error('Photo capture error:', error);
    throw new CameraError('CAPTURE_FAILED', 'Failed to capture photo', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Media Library Selection
// ─────────────────────────────────────────────────────────────────────────────

export interface LibraryMediaResult {
  uri: string;
  type: 'photo';
  width: number;
  height: number;
  mimeType: string;
  sizeBytes?: number;
  exif?: {
    location?: {
      latitude: number;
      longitude: number;
      altitude?: number;
    };
    timestamp?: Date;
  };
}

/**
 * Pick photo from device media library
 * Returns photo with EXIF data if available
 */
export async function pickMediaFromLibrary(): Promise<LibraryMediaResult | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: PHOTO_QUALITY,
      exif: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    if (!asset) {
      return null;
    }

    // Extract EXIF location data if present
    let exifData: LibraryMediaResult['exif'] = undefined;
    if (asset.exif) {
      const location = extractExifLocation(asset.exif);
      const timestamp = extractExifTimestamp(asset.exif);
      
      if (location || timestamp) {
        exifData = {
          location,
          timestamp,
        };
      }
    }

    return {
      uri: asset.uri,
      type: 'photo',
      width: asset.width || 0,
      height: asset.height || 0,
      mimeType: 'image/jpeg',
      sizeBytes: asset.fileSize,
      exif: exifData,
    };
  } catch (error) {
    console.error('Media library picker error:', error);
    throw new CameraError('PICKER_FAILED', 'Failed to select photo from library', error);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract GPS location from EXIF data
 */
function extractExifLocation(exif: any): { latitude: number; longitude: number; altitude?: number } | undefined {
  const lat = exif.GPSLatitude;
  const lon = exif.GPSLongitude;
  const latRef = exif.GPSLatitudeRef;
  const lonRef = exif.GPSLongitudeRef;
  const altitude = exif.GPSAltitude;

  if (typeof lat === 'number' && typeof lon === 'number') {
    // Apply hemisphere references
    const latitude = latRef === 'S' ? -lat : lat;
    const longitude = lonRef === 'W' ? -lon : lon;

    return {
      latitude,
      longitude,
      altitude: typeof altitude === 'number' ? altitude : undefined,
    };
  }

  return undefined;
}

/**
 * Extract timestamp from EXIF data
 */
function extractExifTimestamp(exif: any): Date | undefined {
  const dateTimeOriginal = exif.DateTimeOriginal;
  const dateTime = exif.DateTime;
  const dateTimeDigitized = exif.DateTimeDigitized;

  const dateString = dateTimeOriginal || dateTime || dateTimeDigitized;

  if (dateString && typeof dateString === 'string') {
    try {
      // EXIF date format: "YYYY:MM:DD HH:MM:SS"
      const normalized = dateString.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const date = new Date(normalized);
      
      // Validate the date
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (error) {
      console.warn('Failed to parse EXIF timestamp:', dateString, error);
    }
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Class
// ─────────────────────────────────────────────────────────────────────────────

export class CameraError extends Error {
  code: string;
  originalError?: unknown;

  constructor(code: string, message: string, originalError?: unknown) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
    this.originalError = originalError;
  }
}
