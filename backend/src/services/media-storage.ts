/**
 * Media Storage Service
 * 
 * Handles transient media storage for uploaded files.
 * Supports ephemeral disk storage and optional object store with TTL.
 * 
 * T2.1 Implementation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';
import { getExtensionForMimeType } from '../types/media';

const logger = pino({ name: 'media-storage' });

/**
 * Base directory for ephemeral media storage
 */
const EPHEMERAL_BASE_DIR = process.env.MEDIA_STORAGE_PATH || '/tmp/castsense';

/**
 * Optional object store bucket for persistent storage
 */
const OBJECT_STORE_BUCKET = process.env.OBJECT_STORE_BUCKET;

/**
 * TTL in seconds for object store files (default: 1 hour)
 */
const OBJECT_STORE_TTL_SECONDS = parseInt(process.env.OBJECT_STORE_TTL_SECONDS || '3600', 10);

/**
 * Internal tracking of stored media paths per request
 */
const requestMediaPaths = new Map<string, string>();

/**
 * Ensures the storage directory exists for a request
 */
async function ensureRequestDirectory(requestId: string): Promise<string> {
  const requestDir = path.join(EPHEMERAL_BASE_DIR, requestId);
  await fs.mkdir(requestDir, { recursive: true });
  return requestDir;
}

/**
 * Saves media to ephemeral disk storage
 * 
 * @param requestId - Unique request identifier
 * @param buffer - Media file buffer
 * @param mimeType - MIME type of the media
 * @returns Path to the saved file
 */
export async function saveMedia(
  requestId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const requestDir = await ensureRequestDirectory(requestId);
  const extension = getExtensionForMimeType(mimeType);
  const filename = `media${extension}`;
  const filePath = path.join(requestDir, filename);

  // Write to ephemeral disk
  await fs.writeFile(filePath, buffer);
  
  // Track the path for cleanup
  requestMediaPaths.set(requestId, requestDir);

  logger.info({
    requestId,
    filePath,
    sizeBytes: buffer.length,
    mimeType
  }, 'Media saved to ephemeral storage');

  // Optional: Upload to object store with TTL
  if (OBJECT_STORE_BUCKET) {
    try {
      await uploadToObjectStore(requestId, filePath, mimeType);
    } catch (err) {
      // Log but don't fail - object store is optional
      logger.warn({ err, requestId }, 'Failed to upload to object store');
    }
  }

  return filePath;
}

/**
 * Gets the storage directory path for a request
 * 
 * @param requestId - Unique request identifier
 * @returns Directory path for the request's media
 */
export function getMediaPath(requestId: string): string {
  return requestMediaPaths.get(requestId) || path.join(EPHEMERAL_BASE_DIR, requestId);
}

/**
 * Deletes all media associated with a request (best-effort cleanup)
 * 
 * @param requestId - Unique request identifier
 */
export async function deleteMedia(requestId: string): Promise<void> {
  const requestDir = getMediaPath(requestId);
  
  try {
    await fs.rm(requestDir, { recursive: true, force: true });
    requestMediaPaths.delete(requestId);
    
    logger.info({ requestId, requestDir }, 'Media cleaned up');
  } catch (err) {
    // Best-effort cleanup - log warning but don't throw
    logger.warn({ err, requestId, requestDir }, 'Failed to clean up media');
  }

  // Optional: Delete from object store
  if (OBJECT_STORE_BUCKET) {
    try {
      await deleteFromObjectStore(requestId);
    } catch (err) {
      logger.warn({ err, requestId }, 'Failed to delete from object store');
    }
  }
}

/**
 * Saves a processed file (e.g., keyframe) to the request directory
 * 
 * @param requestId - Unique request identifier
 * @param buffer - File buffer
 * @param filename - Filename for the processed file
 * @returns Path to the saved file
 */
export async function saveProcessedFile(
  requestId: string,
  buffer: Buffer,
  filename: string
): Promise<string> {
  const requestDir = await ensureRequestDirectory(requestId);
  const filePath = path.join(requestDir, filename);
  
  await fs.writeFile(filePath, buffer);
  
  logger.debug({
    requestId,
    filePath,
    sizeBytes: buffer.length
  }, 'Processed file saved');

  return filePath;
}

/**
 * Placeholder for object store upload with TTL
 * Would integrate with S3, GCS, or similar
 */
async function uploadToObjectStore(
  requestId: string,
  filePath: string,
  mimeType: string
): Promise<void> {
  // TODO: Implement actual object store integration
  // This would:
  // 1. Read the file
  // 2. Upload to OBJECT_STORE_BUCKET with key: `{requestId}/media`
  // 3. Set expiration/TTL based on OBJECT_STORE_TTL_SECONDS
  
  logger.debug({
    requestId,
    bucket: OBJECT_STORE_BUCKET,
    ttlSeconds: OBJECT_STORE_TTL_SECONDS
  }, 'Object store upload placeholder (not implemented)');
}

/**
 * Placeholder for object store deletion
 */
async function deleteFromObjectStore(requestId: string): Promise<void> {
  // TODO: Implement actual object store deletion
  // This would delete all objects with prefix: `{requestId}/`
  
  logger.debug({
    requestId,
    bucket: OBJECT_STORE_BUCKET
  }, 'Object store delete placeholder (not implemented)');
}

/**
 * Cleanup utility to purge old media directories
 * Can be called periodically to clean up orphaned files
 * 
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 */
export async function purgeOldMedia(maxAgeMs: number = 3600000): Promise<number> {
  let purgedCount = 0;
  const cutoffTime = Date.now() - maxAgeMs;

  try {
    const entries = await fs.readdir(EPHEMERAL_BASE_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(EPHEMERAL_BASE_DIR, entry.name);
        const stat = await fs.stat(dirPath);
        
        if (stat.mtimeMs < cutoffTime) {
          await fs.rm(dirPath, { recursive: true, force: true });
          purgedCount++;
        }
      }
    }
    
    if (purgedCount > 0) {
      logger.info({ purgedCount, maxAgeMs }, 'Purged old media directories');
    }
  } catch (err) {
    // Base directory might not exist yet
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn({ err }, 'Error purging old media');
    }
  }

  return purgedCount;
}

export default {
  saveMedia,
  getMediaPath,
  deleteMedia,
  saveProcessedFile,
  purgeOldMedia
};
