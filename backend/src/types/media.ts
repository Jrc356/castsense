/**
 * Media Processing Types
 * 
 * Types for media storage, image/video processing, and analysis frames
 */

/**
 * Information about an extracted video keyframe
 */
export interface KeyframeInfo {
  /** Path to the keyframe image file */
  path: string;
  /** Timestamp in the video in milliseconds */
  timestamp_ms: number;
  /** Frame width in pixels */
  width: number;
  /** Frame height in pixels */
  height: number;
  /** Index of this keyframe (0, 1, 2 for 3 frames) */
  index: number;
}

/**
 * Result of processing an image
 */
export interface ProcessedImageInfo {
  /** Path to the processed image */
  path: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

/**
 * Analysis frame metadata for overlay rendering
 */
export interface AnalysisFrame {
  /** Type of source media */
  type: 'photo' | 'video_frame';
  /** Frame width in pixels */
  width_px: number;
  /** Frame height in pixels */
  height_px: number;
  /** For video: index of selected keyframe (0-based) */
  selected_frame_index?: number;
  /** For video: timestamp of frame in milliseconds */
  frame_timestamp_ms?: number;
}

/**
 * MIME type to file extension mapping
 */
export const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov'
};

/**
 * Get file extension for a MIME type
 */
export function getExtensionForMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] || '.bin';
}
