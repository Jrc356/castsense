/**
 * CastSense Permissions Service
 * 
 * Handles requesting and checking permissions for:
 * - Camera
 * - Microphone (for video with audio)
 * - Location
 */

import {Platform, PermissionsAndroid, Alert, Linking} from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  type Permission,
  type PermissionStatus,
  openSettings,
} from 'react-native-permissions';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PermissionState {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  location: PermissionStatus;
}

export type PermissionType = 'camera' | 'microphone' | 'location';

// ─────────────────────────────────────────────────────────────────────────────
// Platform-specific Permission Mappings
// ─────────────────────────────────────────────────────────────────────────────

function getCameraPermission(): Permission {
  return Platform.select({
    ios: PERMISSIONS.IOS.CAMERA,
    android: PERMISSIONS.ANDROID.CAMERA,
    default: PERMISSIONS.ANDROID.CAMERA,
  });
}

function getMicrophonePermission(): Permission {
  return Platform.select({
    ios: PERMISSIONS.IOS.MICROPHONE,
    android: PERMISSIONS.ANDROID.RECORD_AUDIO,
    default: PERMISSIONS.ANDROID.RECORD_AUDIO,
  });
}

function getLocationPermission(): Permission {
  return Platform.select({
    ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    default: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Checking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check all required permissions
 */
export async function checkAllPermissions(): Promise<PermissionState> {
  const [camera, microphone, location] = await Promise.all([
    check(getCameraPermission()),
    check(getMicrophonePermission()),
    check(getLocationPermission()),
  ]);

  return {
    camera,
    microphone,
    location,
  };
}

/**
 * Check if a specific permission is granted
 */
export async function isPermissionGranted(
  type: PermissionType
): Promise<boolean> {
  let permission: Permission;
  
  switch (type) {
    case 'camera':
      permission = getCameraPermission();
      break;
    case 'microphone':
      permission = getMicrophonePermission();
      break;
    case 'location':
      permission = getLocationPermission();
      break;
  }

  const result = await check(permission);
  return result === RESULTS.GRANTED;
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
  let permission: Permission;
  
  switch (type) {
    case 'camera':
      permission = getCameraPermission();
      break;
    case 'microphone':
      permission = getMicrophonePermission();
      break;
    case 'location':
      permission = getLocationPermission();
      break;
  }

  const result = await request(permission);
  return result;
}

/**
 * Request camera permission with rationale
 */
export async function requestCameraPermission(): Promise<boolean> {
  const status = await requestPermission('camera');
  
  if (status === RESULTS.BLOCKED || status === RESULTS.DENIED) {
    showPermissionDeniedAlert(
      'Camera Permission Required',
      'CastSense needs camera access to capture photos and videos of fishing spots for analysis.'
    );
    return false;
  }
  
  return status === RESULTS.GRANTED;
}

/**
 * Request microphone permission with rationale
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  const status = await requestPermission('microphone');
  
  if (status === RESULTS.BLOCKED || status === RESULTS.DENIED) {
    showPermissionDeniedAlert(
      'Microphone Permission Required',
      'CastSense needs microphone access to record videos with audio.'
    );
    return false;
  }
  
  return status === RESULTS.GRANTED;
}

/**
 * Request location permission with rationale
 */
export async function requestLocationPermission(): Promise<boolean> {
  const status = await requestPermission('location');
  
  if (status === RESULTS.BLOCKED || status === RESULTS.DENIED) {
    showPermissionDeniedAlert(
      'Location Permission Recommended',
      'CastSense uses your location to provide weather conditions, sunrise/sunset times, and local fishing information. Without location, analysis will be limited.'
    );
    return false;
  }
  
  return status === RESULTS.GRANTED;
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
          openSettings().catch(() => {
            // Fallback for older versions
            Linking.openSettings();
          });
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
  return state.camera === RESULTS.GRANTED;
}

/**
 * Check if location permission is available (granted or can be requested)
 */
export async function canUseLocation(): Promise<boolean> {
  const state = await checkAllPermissions();
  return (
    state.location === RESULTS.GRANTED ||
    state.location === RESULTS.DENIED // Can still request
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Status Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isGranted(status: PermissionStatus): boolean {
  return status === RESULTS.GRANTED;
}

export function isDenied(status: PermissionStatus): boolean {
  return status === RESULTS.DENIED;
}

export function isBlocked(status: PermissionStatus): boolean {
  return status === RESULTS.BLOCKED;
}

export function isUnavailable(status: PermissionStatus): boolean {
  return status === RESULTS.UNAVAILABLE;
}
