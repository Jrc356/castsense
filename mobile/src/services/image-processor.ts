/**
 * Image Processor Service (Mobile)
 * 
 * Handles photo preprocessing including downscaling for AI analysis.
 * Uses expo-image-manipulator instead of Sharp.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

export interface ProcessedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
  wasResized: boolean;
}

/**
 * Process a photo for AI analysis
 * - Reads image dimensions
 * - Downscales if long edge exceeds MAX_IMAGE_DIMENSION
 * - Returns base64-encoded data URL for AI consumption
 * 
 * @param uri - URI to the captured photo
 * @returns Processed image with base64 data
 */
export async function processImage(uri: string): Promise<ProcessedImage> {
  try {
    // Get original image dimensions
    const imageInfo = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    const originalWidth = imageInfo.width;
    const originalHeight = imageInfo.height;
    const longEdge = Math.max(originalWidth, originalHeight);

    console.log('[ImageProcessor] Original dimensions:', {
      width: originalWidth,
      height: originalHeight
    });

    let processedUri = uri;
    let finalWidth = originalWidth;
    let finalHeight = originalHeight;
    let wasResized = false;

    // Check if downscaling is needed
    if (longEdge > MAX_IMAGE_DIMENSION) {
      const scale = MAX_IMAGE_DIMENSION / longEdge;
      finalWidth = Math.round(originalWidth * scale);
      finalHeight = Math.round(originalHeight * scale);

      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: finalWidth, height: finalHeight } }],
        { 
          compress: JPEG_QUALITY, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );

      processedUri = resized.uri;
      wasResized = true;

      console.log('[ImageProcessor] Image downscaled:', {
        originalDimensions: { width: originalWidth, height: originalHeight },
        newDimensions: { width: finalWidth, height: finalHeight },
        scale: scale.toFixed(3)
      });
    }

    // Read as base64 for AI transmission
    const base64 = await FileSystem.readAsStringAsync(processedUri, {
      encoding: FileSystem.EncodingType.Base64
    });

    return {
      uri: processedUri,
      base64,
      width: finalWidth,
      height: finalHeight,
      wasResized
    };

  } catch (error) {
    console.error('[ImageProcessor] Failed to process image:', error);
    throw new Error(
      `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get image dimensions without processing (quick check)
 */
export async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], {
      format: ImageManipulator.SaveFormat.JPEG
    });
    return { width: info.width, height: info.height };
  } catch (error) {
    throw new Error(
      `Failed to read image dimensions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
