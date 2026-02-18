/**
 * CastSense Permissions Service (Expo)
 * 
 * Handles requesting and checking permissions for:
 * - Camera
 * - Microphone (for video with audio)
 * - Location
 */

import {Alert, Linking} from 'react-native';
import {Camera} from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PermissionState {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  location: PermissionStatus;
}

export type PermissionType = 'camera' | 'microphone' | 'location';

// ─────────────────────────────────────────────────────────────────────────────
// Permission Status Conversion
// ─────────────────────────────────────────────────────────────────────────────

function convertStatus(expoStatus: any): PermissionStatus {
  if (expoStatus?.granted) return 'granted';
  if (expoStatus?.canAskAgain === false) return 'denied';
  return 'undetermined';
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Checking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check all required permissions
 */
export async function checkAllPermissions(): Promise<PermissionState> {
  const [cameraStatus, microphoneStatus, locationStatus] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Camera.getMicrophonePermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
  ]);

  return {
    camera: convertStatus(cameraStatus),
    microphone: convertStatus(microphoneStatus),
    location: convertStatus(locationStatus),
  };
}

/**
 * Check if a specific permission is granted
 */
export async function isPermissionGranted(
  type: PermissionType
): Promise<boolean> {
  let status;
  
  switch (type) {
    case 'camera':
      status = await Camera.getCameraPermissionsAsync();
      break;
    case 'microphone':
      status = await Camera.getMicrophonePermissionsAsync();
      break;
    case 'location':
      status = await Location.getForegroundPermissionsAsync();
      break;
  }

  return status.granted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Requesting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request a single permission
 */
export async function requestPermission(
  type: PermissionType
): Promise<PermissionStatus> {
  let result;
  
  switch (type) {
    case 'camera':
      result = await Camera.requestCameraPermissionsAsync();
      break;
    case 'microphone':
      result = await Camera.requestMicrophonePermissionsAsync();
      break;
    case 'location':
      result = await Location.requestForegroundPermissionsAsync();
      break;
  }

  return convertStatus(result);
}

/**
 * Request camera permission with rationale
 */
export async function requestCameraPermission(): Promise<boolean> {
  const status = await requestPermission('camera');
  
  if (status === 'denied') {
    showPermissionDeniedAlert(
      'Camera Permission Required',
      'CastSense needs camera access to capture photos and videos of fishing spots for analysis.'
    );
    return false;
  }
  
  return status === 'granted';
}

/**
 * Request microphone permission with rationale
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  const status = await requestPermission('microphone');
  
  if (status === 'denied') {
    showPermissionDeniedAlert(
      'Microphone Permission Required',
      'CastSense needs microphone access to record videos with audio.'
    );
    return false;
  }
  
  return status === 'granted';
}

/**
 * Request location permission with rationale
 */
export async function requestLocationPermission(): Promise<boolean> {
  const status = await requestPermission('location');
  
  if (status === 'denied') {
    showPermissionDeniedAlert(
      'Location Permission Recommended',
      'CastSense uses your location to provide weather conditions, sunrise/sunset times, and local fishing information. Without location, analysis will be limited.'
    );
    return false;
  }
  
  return status === 'granted';
}

/**
 * Request all permissions needed for capture
 */
export async function requestCapturePermissions(): Promise<{
  camera: boolean;
  microphone: boolean;
  location: boolean;
}> {
  const camera = await requestCameraPermission();
  const microphone = await requestMicrophonePermission();
  const location = await requestLocationPermission();

  return {
    camera,
    microphone,
    location,
  };
}

/**
 * Request only camera and microphone (required for capture)
 */
export async function requestRequiredCapturePermissions(): Promise<boolean> {
  const camera = await requestCameraPermission();
  if (!camera) return false;
  
  const microphone = await requestMicrophonePermission();
  // Microphone is optional for photos, but let's request it
  // Video capture will check separately
  
  return camera;
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission UI Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show alert when permission is denied/blocked with option to open settings
 */
function showPermissionDeniedAlert(title: string, message: string): void {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings();
        },
      },
    ],
    { cancelable: true }
  );
}

/**
 * Check if all required permissions for capture are granted
 */
export async function hasCapturePermissions(): Promise<boolean> {
  const state = await checkAllPermissions();
  return state.camera === 'granted';
}

/**
 * Check if location permission is available (granted or can be requested)
 */
export async function canUseLocation(): Promise<boolean> {
  const state = await checkAllPermissions();
  return (
    state.location === 'granted' ||
    state.location === 'undetermined' // Can still request
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Status Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isGranted(status: PermissionStatus): boolean {
  return status === 'granted';
}

export function isDenied(status: PermissionStatus): boolean {
  return status === 'denied';
}

export function isBlocked(status: PermissionStatus): boolean {
  return status === 'denied';
}

export function isUnavailable(status: PermissionStatus): boolean {
  return false; // Expo doesn't have an 'unavailable' status
}

// Compatibility exports for code that uses RESULTS constants
export const RESULTS = {
  GRANTED: 'granted' as const,
  DENIED: 'denied' as const,
  BLOCKED: 'denied' as const,
  UNAVAILABLE: 'denied' as const,
};
