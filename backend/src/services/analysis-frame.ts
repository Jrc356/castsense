/**
 * Analysis Frame Service
 * 
 * Defines the "analysis frame" selection contract for photos and videos.
 * The analysis frame is the reference frame used for overlay rendering.
 * 
 * T2.4 Implementation
 */

import pino from 'pino';
import { AnalysisFrame, KeyframeInfo } from '../types/media';

const logger = pino({ name: 'analysis-frame' });

/**
 * Default middle frame index (for 3 keyframes: 0, 1, 2 -> middle is 1)
 */
const DEFAULT_FRAME_INDEX = 1;

/**
 * Builds an analysis frame for a photo
 * 
 * For photos, the analysis frame is simply the processed photo
 * with type="photo" and the image dimensions.
 * 
 * @param imageInfo - Processed image info with dimensions
 * @returns Analysis frame metadata
 */
export function buildPhotoAnalysisFrame(imageInfo: { width: number; height: number }): AnalysisFrame {
  const frame: AnalysisFrame = {
    type: 'photo',
    width_px: imageInfo.width,
    height_px: imageInfo.height
  };

  logger.debug({
    type: frame.type,
    dimensions: { width: frame.width_px, height: frame.height_px }
  }, 'Photo analysis frame built');

  return frame;
}

/**
 * Result of building a video analysis frame
 */
export interface VideoAnalysisFrameResult {
  /** The analysis frame metadata */
  frame: AnalysisFrame;
  /** Whether the frame selection was degraded (AI didn't specify) */
  degraded: boolean;
  /** Reason for degradation if applicable */
  degradedReason?: string;
}

/**
 * Builds an analysis frame for a video
 * 
 * For videos:
 * - AI returns `selected_frame_index` indicating which keyframe the overlay refers to
 * - If AI omits it, defaults to middle frame (index 1) and marks as degraded
 * - Analysis frame includes video-specific metadata
 * 
 * @param frames - Array of extracted keyframes
 * @param selectedIndex - AI-selected frame index (optional)
 * @returns Analysis frame result with degradation status
 */
export function buildVideoAnalysisFrame(
  frames: KeyframeInfo[],
  selectedIndex?: number
): VideoAnalysisFrameResult {
  // Handle empty frames case
  if (frames.length === 0) {
    logger.warn('No keyframes available for video analysis frame');
    return {
      frame: {
        type: 'video_frame',
        width_px: 0,
        height_px: 0,
        selected_frame_index: 0,
        frame_timestamp_ms: 0
      },
      degraded: true,
      degradedReason: 'no_keyframes_extracted'
    };
  }

  let finalIndex: number;
  let degraded = false;
  let degradedReason: string | undefined;

  // Determine which frame to use
  if (selectedIndex !== undefined && selectedIndex !== null) {
    // AI specified a frame index
    if (selectedIndex >= 0 && selectedIndex < frames.length) {
      finalIndex = selectedIndex;
      logger.debug({ selectedIndex }, 'Using AI-selected frame index');
    } else {
      // Invalid index - fall back to middle frame
      finalIndex = getMiddleFrameIndex(frames.length);
      degraded = true;
      degradedReason = 'invalid_frame_index';
      logger.warn({
        selectedIndex,
        framesCount: frames.length,
        fallbackIndex: finalIndex
      }, 'Invalid frame index from AI, using middle frame');
    }
  } else {
    // AI didn't specify - use middle frame (degraded)
    finalIndex = getMiddleFrameIndex(frames.length);
    degraded = true;
    degradedReason = 'frame_index_not_specified';
    logger.info({
      framesCount: frames.length,
      defaultIndex: finalIndex
    }, 'No frame index from AI, defaulting to middle frame');
  }

  const selectedFrame = frames[finalIndex]!;

  const frame: AnalysisFrame = {
    type: 'video_frame',
    width_px: selectedFrame.width,
    height_px: selectedFrame.height,
    selected_frame_index: finalIndex,
    frame_timestamp_ms: selectedFrame.timestamp_ms
  };

  logger.debug({
    type: frame.type,
    dimensions: { width: frame.width_px, height: frame.height_px },
    selectedFrameIndex: finalIndex,
    timestampMs: selectedFrame.timestamp_ms,
    degraded
  }, 'Video analysis frame built');

  return {
    frame,
    degraded,
    degradedReason
  };
}

/**
 * Gets the middle frame index for an array of frames
 */
function getMiddleFrameIndex(frameCount: number): number {
  if (frameCount === 0) return 0;
  return Math.floor(frameCount / 2);
}

/**
 * Validates a frame selection from AI response
 * 
 * @param index - Frame index to validate
 * @param frameCount - Total number of available frames
 * @returns Whether the index is valid
 */
export function isValidFrameIndex(index: number | undefined | null, frameCount: number): boolean {
  if (index === undefined || index === null) return false;
  if (!Number.isInteger(index)) return false;
  return index >= 0 && index < frameCount;
}

/**
 * Gets frame info for a specific index
 * 
 * @param frames - Array of keyframes
 * @param index - Frame index
 * @returns Keyframe info or undefined if invalid
 */
export function getFrameAtIndex(frames: KeyframeInfo[], index: number): KeyframeInfo | undefined {
  if (!isValidFrameIndex(index, frames.length)) {
    return undefined;
  }
  return frames[index];
}

/**
 * Selects the best frame based on various heuristics
 * This can be extended to use quality scoring, sharpness detection, etc.
 * 
 * Currently just returns the middle frame as a baseline implementation.
 * 
 * @param frames - Array of keyframes
 * @returns Index of the best frame
 */
export function selectBestFrame(frames: KeyframeInfo[]): number {
  if (frames.length === 0) return 0;
  
  // For now, middle frame is the default "best" choice
  // Future: could add sharpness detection, motion blur analysis, etc.
  return getMiddleFrameIndex(frames.length);
}

export default {
  buildPhotoAnalysisFrame,
  buildVideoAnalysisFrame,
  isValidFrameIndex,
  getFrameAtIndex,
  selectBestFrame
};
