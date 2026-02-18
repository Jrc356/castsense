/**
 * Image Processor Service
 * 
 * Handles photo preprocessing including dimension reading and optional downscaling.
 * 
 * T2.2 Implementation
 */

import sharp from 'sharp';
import * as path from 'path';
import pino from 'pino';
import { ProcessedImageInfo } from '../types/media';

const logger = pino({ name: 'image-processor' });

/**
 * Maximum dimension for the long edge of processed images
 * Configurable via MAX_IMAGE_DIMENSION env variable
 */
const MAX_IMAGE_DIMENSION = parseInt(process.env.MAX_IMAGE_DIMENSION || '1920', 10);

/**
 * Whether to downscale images exceeding MAX_IMAGE_DIMENSION
 */
const ENABLE_DOWNSCALE = process.env.DISABLE_IMAGE_DOWNSCALE !== 'true';

/**
 * JPEG quality for processed images (0-100)
 */
const JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || '85', 10);

/**
 * Processes a photo for analysis
 * - Reads image dimensions
 * - Optionally downscales if long edge exceeds MAX_IMAGE_DIMENSION
 * - Returns processed image metadata
 * 
 * @param inputPath - Path to the input image file
 * @returns Processed image info including dimensions and path
 */
export async function processPhoto(inputPath: string): Promise<ProcessedImageInfo> {
  const startTime = Date.now();
  
  try {
    // Read image metadata
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to read image dimensions');
    }

    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    const longEdge = Math.max(originalWidth, originalHeight);

    logger.info({
      inputPath,
      originalWidth,
      originalHeight,
      format: metadata.format
    }, 'Image metadata read');

    // Check if downscaling is needed
    if (ENABLE_DOWNSCALE && longEdge > MAX_IMAGE_DIMENSION) {
      return await downscaleImage(
        image,
        inputPath,
        originalWidth,
        originalHeight,
        longEdge
      );
    }

    // No processing needed - return original dimensions
    const durationMs = Date.now() - startTime;
    logger.info({
      inputPath,
      width: originalWidth,
      height: originalHeight,
      durationMs
    }, 'Photo processed (no resize needed)');

    return {
      path: inputPath,
      width: originalWidth,
      height: originalHeight
    };

  } catch (err) {
    logger.error({ err, inputPath }, 'Failed to process photo');
    throw new Error(`Image processing failed: ${(err as Error).message}`);
  }
}

/**
 * Downscales an image to fit within MAX_IMAGE_DIMENSION
 */
async function downscaleImage(
  image: sharp.Sharp,
  inputPath: string,
  originalWidth: number,
  originalHeight: number,
  longEdge: number
): Promise<ProcessedImageInfo> {
  const startTime = Date.now();
  
  // Calculate scale factor
  const scale = MAX_IMAGE_DIMENSION / longEdge;
  const newWidth = Math.round(originalWidth * scale);
  const newHeight = Math.round(originalHeight * scale);

  // Generate output path (same directory, add _processed suffix)
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  const outputPath = path.join(dir, `${basename}_processed.jpg`);

  // Resize and save
  await image
    .resize(newWidth, newHeight, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(outputPath);

  const durationMs = Date.now() - startTime;
  
  logger.info({
    inputPath,
    outputPath,
    originalDimensions: { width: originalWidth, height: originalHeight },
    newDimensions: { width: newWidth, height: newHeight },
    scale: scale.toFixed(3),
    durationMs
  }, 'Photo downscaled');

  return {
    path: outputPath,
    width: newWidth,
    height: newHeight
  };
}

/**
 * Gets image dimensions without processing
 * Useful for quick metadata checks
 * 
 * @param imagePath - Path to the image file
 * @returns Width and height in pixels
 */
export async function getImageDimensions(imagePath: string): Promise<{ width: number; height: number }> {
  const metadata = await sharp(imagePath).metadata();
  
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions');
  }

  return {
    width: metadata.width,
    height: metadata.height
  };
}

/**
 * Rotates an image according to EXIF orientation and saves
 * Sharp handles this automatically, but this provides explicit control
 * 
 * @param inputPath - Path to the input image
 * @param outputPath - Path for the output image
 */
export async function normalizeOrientation(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .rotate() // Auto-rotate based on EXIF
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(outputPath);
}

export default {
  processPhoto,
  getImageDimensions,
  normalizeOrientation
};
