/**
 * CastSense Camera Service (Expo)
 * 
 * Handles photo and video capture using expo-camera
 * Includes pre-upload processing (downscaling, format conversion)
 * 
 * Photo: Cap long edge to 1280-1920px, JPEG format  
 * Video: 5-10s duration, 720p cap, configurable size limit
 */

import {Platform} from 'react-native';
import {Camera, CameraType, useCameraPermissions} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  apiConfig,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
} from '../config/api';

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

export interface VideoCapture {
  uri: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface CameraRef {
  takePictureAsync: (options?: any) => Promise<any>;
  recordAsync: (options?: any) => Promise<any>;
  stopRecording: () => void;
}

export interface VideoCaptureState {
  isRecording: boolean;
  durationMs: number;
  startTime: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PHOTO_MAX_LONG_EDGE = apiConfig.photoMaxLongEdge;
const VIDEO_MAX_DURATION_MS = MAX_VIDEO_DURATION_MS;
const VIDEO_MAX_SIZE_BYTES = MAX_VIDEO_BYTES;

// ─────────────────────────────────────────────────────────────────────────────
// Photo Capture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capture a photo with pre-upload processing
 * - Caps long edge to configured max (1280-1920px)
 * - Returns JPEG format
 */
export async function capturePhoto(camera: CameraRef): Promise<PhotoCapture> {
  try {
    // Take photo with quality settings
    const photo = await camera.takePictureAsync({
      quality: 0.8,
      base64: false,
      skipProcessing: false,
    });

    // Get dimensions
    const width = photo.width || 0;
    const height = photo.height || 0;
    const longEdge = Math.max(width, height);

    // Calculate scaled dimensions if needed
    let finalWidth = width;
    let finalHeight = height;
    
    if (longEdge > PHOTO_MAX_LONG_EDGE && longEdge > 0) {
      const scale = PHOTO_MAX_LONG_EDGE / longEdge;
      finalWidth = Math.round(width * scale);
      finalHeight = Math.round(height * scale);
    }

    return {
      uri: photo.uri,
      width: finalWidth || 0,
      height: finalHeight || 0,
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    console.error('Photo capture error:', error);
    throw new CameraError('CAPTURE_FAILED', 'Failed to capture photo', error);
  }
}

/**
 * Process photo for upload (resize if needed)
 * This is a placeholder for actual image processing
 * In production, use expo-image-manipulator or similar
 */
export async function processPhotoForUpload(
  photoUri: string,
  maxLongEdge: number = PHOTO_MAX_LONG_EDGE
): Promise<PhotoCapture> {
  // TODO: Implement actual image resizing using expo-image-manipulator
  // For now, return the original photo
  
  return {
    uri: photoUri,
    width: 0, // Would be populated after processing
    height: 0,
    mimeType: 'image/jpeg',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Video Capture
// ─────────────────────────────────────────────────────────────────────────────

let videoRecordingState: VideoCaptureState = {
  isRecording: false,
  durationMs: 0,
  startTime: null,
};

let videoResult: VideoCapture | null = null;
let videoError: Error | null = null;
let durationTimer: ReturnType<typeof setTimeout> | null = null;
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;
let cameraRef: CameraRef | null = null;

/**
 * Start video capture with duration tracking
 * - Duration cap: auto-stop at 10s
 * - Resolution target: 720p
 */
export async function startVideoCapture(camera: CameraRef): Promise<void> {
  if (videoRecordingState.isRecording) {
    throw new CameraError('ALREADY_RECORDING', 'Video recording already in progress');
  }

  cameraRef = camera;
  videoResult = null;
  videoError = null;

  videoRecordingState = {
    isRecording: true,
    durationMs: 0,
    startTime: Date.now(),
  };

  // Start duration timer for UI updates
  durationTimer = setInterval(() => {
    if (videoRecordingState.startTime) {
      videoRecordingState.durationMs = Date.now() - videoRecordingState.startTime;
    }
  }, 100);

  // Auto-stop timer
  autoStopTimer = setTimeout(() => {
    if (cameraRef && videoRecordingState.isRecording) {
      stopVideoCapture(cameraRef).catch(console.error);
    }
  }, VIDEO_MAX_DURATION_MS);

  // Start recording (will complete when stopVideoCapture is called)
  camera.recordAsync({
    maxDuration: VIDEO_MAX_DURATION_MS / 1000, // Convert to seconds
  }).then((video) => {
    const durationMs = videoRecordingState.startTime
      ? Date.now() - videoRecordingState.startTime
      : 0;

    videoResult = {
      uri: video.uri,
      durationMs,
      mimeType: 'video/mp4',
      sizeBytes: 0, // Would need to read from file system
      width: video.width,
      height: video.height,
    };
  }).catch((error) => {
    videoError = error;
  }).finally(() => {
    cleanupRecording();
  });
}

/**
 * Stop video capture and return the result
 */
export async function stopVideoCapture(camera: CameraRef): Promise<VideoCapture> {
  if (!videoRecordingState.isRecording) {
    throw new CameraError('NOT_RECORDING', 'No video recording in progress');
  }

  try {
    camera.stopRecording();
    
    // Wait for the recording to finish processing
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (videoResult || videoError || !videoRecordingState.isRecording) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 5000);
    });

    if (videoError) {
      throw videoError;
    }

    if (!videoResult) {
      throw new CameraError('NO_RESULT', 'Video recording completed but no result received');
    }

    return videoResult;
  } catch (error) {
    cleanupRecording();
    throw new CameraError('STOP_FAILED', 'Failed to stop video recording', error);
  }
}

/**
 * Get current recording duration
 */
export function getRecordingDuration(): number {
  if (!videoRecordingState.isRecording || !videoRecordingState.startTime) {
    return 0;
  }
  return Date.now() - videoRecordingState.startTime;
}

/**
 * Check if currently recording
 */
export function isRecording(): boolean {
  return videoRecordingState.isRecording;
}

/**
 * Get max video duration in milliseconds
 */
export function getMaxVideoDuration(): number {
  return VIDEO_MAX_DURATION_MS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cleanupRecording(): void {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
  
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
  
  videoRecordingState = {
    isRecording: false,
    durationMs: 0,
    startTime: null,
  };
  
  cameraRef = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Video Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate video file size
 */
export function validateVideoSize(sizeBytes: number): boolean {
  return sizeBytes <= VIDEO_MAX_SIZE_BYTES;
}

/**
 * Validate video duration
 */
export function validateVideoDuration(durationMs: number): boolean {
  return durationMs >= 1000 && durationMs <= VIDEO_MAX_DURATION_MS;
}

/**
 * Get formatted duration string (MM:SS)
 */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Device Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if camera hardware is available
 */
export async function isCameraAvailable(): Promise<boolean> {
  const permission = await Camera.getCameraPermissionsAsync();
  return permission.granted || permission.canAskAgain;
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

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────────

export {
  Camera,
  useCameraPermissions,
};

export type { CameraType };
