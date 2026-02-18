/**
 * Video Processor Service
 * 
 * Handles video keyframe extraction using ffmpeg.
 * Extracts N frames at specified percentages of video duration.
 * 
 * T2.3 Implementation
 */

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';
import sharp from 'sharp';
import { KeyframeInfo } from '../types/media';
import { getMediaPath } from './media-storage';

const logger = pino({ name: 'video-processor' });

/**
 * Number of keyframes to extract
 */
const NUM_KEYFRAMES = 3;

/**
 * Percentages of video duration at which to extract frames
 */
const FRAME_PERCENTAGES = [0.20, 0.50, 0.80];

/**
 * Maximum long edge dimension for keyframe images
 */
const KEYFRAME_MAX_DIMENSION = parseInt(process.env.KEYFRAME_MAX_DIMENSION || '1280', 10);

/**
 * JPEG quality for keyframe images
 */
const KEYFRAME_JPEG_QUALITY = parseInt(process.env.KEYFRAME_JPEG_QUALITY || '85', 10);

/**
 * Gets the duration of a video in milliseconds
 * 
 * @param videoPath - Path to the video file
 * @returns Duration in milliseconds
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        logger.error({ err, videoPath }, 'Failed to probe video');
        reject(new Error(`Failed to probe video: ${err.message}`));
        return;
      }

      const durationSeconds = metadata.format.duration;
      if (durationSeconds === undefined || durationSeconds <= 0) {
        reject(new Error('Unable to determine video duration'));
        return;
      }

      const durationMs = Math.round(durationSeconds * 1000);
      logger.debug({ videoPath, durationMs }, 'Video duration retrieved');
      resolve(durationMs);
    });
  });
}

/**
 * Extracts keyframes from a video at specified percentages
 * 
 * @param videoPath - Path to the video file
 * @param requestId - Request ID for organizing output files
 * @returns Array of keyframe information
 */
export async function extractKeyframes(
  videoPath: string,
  requestId: string
): Promise<KeyframeInfo[]> {
  const startTime = Date.now();
  const keyframes: KeyframeInfo[] = [];

  try {
    // Get video duration
    const durationMs = await getVideoDuration(videoPath);
    
    if (durationMs < 100) {
      logger.warn({ videoPath, durationMs }, 'Video too short for keyframe extraction');
      return [];
    }

    // Get output directory
    const outputDir = getMediaPath(requestId);
    await fs.mkdir(outputDir, { recursive: true });

    // Extract frames at each percentage
    for (let i = 0; i < NUM_KEYFRAMES; i++) {
      const percentage = FRAME_PERCENTAGES[i]!;
      const timestampMs = Math.round(durationMs * percentage);
      const timestampSeconds = timestampMs / 1000;

      try {
        const frameInfo = await extractSingleFrame(
          videoPath,
          outputDir,
          i,
          timestampSeconds,
          timestampMs
        );
        
        if (frameInfo) {
          keyframes.push(frameInfo);
        }
      } catch (frameErr) {
        logger.warn({
          err: frameErr,
          videoPath,
          frameIndex: i,
          timestampMs
        }, 'Failed to extract single frame');
        // Continue with other frames
      }
    }

    const durationTotal = Date.now() - startTime;
    logger.info({
      videoPath,
      requestId,
      videoDurationMs: durationMs,
      framesExtracted: keyframes.length,
      processingDurationMs: durationTotal
    }, 'Keyframe extraction complete');

    return keyframes;

  } catch (err) {
    logger.error({ err, videoPath, requestId }, 'Keyframe extraction failed');
    // Return empty array on failure per spec
    return [];
  }
}

/**
 * Extracts a single frame from the video and processes it
 */
async function extractSingleFrame(
  videoPath: string,
  outputDir: string,
  index: number,
  timestampSeconds: number,
  timestampMs: number
): Promise<KeyframeInfo | null> {
  const rawFramePath = path.join(outputDir, `keyframe_${index}_raw.jpg`);
  const finalFramePath = path.join(outputDir, `keyframe_${index}.jpg`);

  // Extract raw frame using ffmpeg
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestampSeconds)
      .frames(1)
      .output(rawFramePath)
      .outputOptions([
        '-q:v', '2' // High quality for initial extraction
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });

  // Check if frame was extracted
  try {
    await fs.access(rawFramePath);
  } catch {
    logger.warn({ rawFramePath, timestampSeconds }, 'Frame file not created');
    return null;
  }

  // Process the frame: resize and optimize
  const image = sharp(rawFramePath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    logger.warn({ rawFramePath }, 'Unable to read frame dimensions');
    await fs.unlink(rawFramePath).catch(() => {});
    return null;
  }

  const longEdge = Math.max(metadata.width, metadata.height);
  let finalWidth = metadata.width;
  let finalHeight = metadata.height;

  // Resize if needed
  if (longEdge > KEYFRAME_MAX_DIMENSION) {
    const scale = KEYFRAME_MAX_DIMENSION / longEdge;
    finalWidth = Math.round(metadata.width * scale);
    finalHeight = Math.round(metadata.height * scale);

    await image
      .resize(finalWidth, finalHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: KEYFRAME_JPEG_QUALITY })
      .toFile(finalFramePath);
  } else {
    // Just copy with JPEG optimization
    await image
      .jpeg({ quality: KEYFRAME_JPEG_QUALITY })
      .toFile(finalFramePath);
  }

  // Clean up raw frame
  await fs.unlink(rawFramePath).catch(() => {});

  logger.debug({
    index,
    timestampMs,
    width: finalWidth,
    height: finalHeight,
    path: finalFramePath
  }, 'Keyframe extracted');

  return {
    path: finalFramePath,
    timestamp_ms: timestampMs,
    width: finalWidth,
    height: finalHeight,
    index
  };
}

/**
 * Gets video metadata including resolution and codec info
 * 
 * @param videoPath - Path to the video file
 * @returns Video metadata object
 */
export async function getVideoMetadata(videoPath: string): Promise<{
  durationMs: number;
  width: number;
  height: number;
  codec: string | undefined;
  fps: number | undefined;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe video: ${err.message}`));
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      const durationMs = Math.round((metadata.format.duration || 0) * 1000);
      
      // Parse framerate (can be "30/1" format)
      let fps: number | undefined;
      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/').map(Number);
        const num = parts[0];
        const den = parts[1];
        fps = (den && num) ? num / den : num;
      }

      resolve({
        durationMs,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        codec: videoStream.codec_name,
        fps
      });
    });
  });
}

export default {
  getVideoDuration,
  extractKeyframes,
  getVideoMetadata
};
