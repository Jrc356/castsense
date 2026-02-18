/**
 * Analyze Route
 * 
 * POST /v1/analyze - Multipart media analysis endpoint
 * Implements T1.3, T1.4, T3.1-T3.6 requirements
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { 
  createRequestContext, 
  startTimer, 
  endTimer, 
  finalizeTimings,
  RequestContext 
} from '../utils/request-context';
import { createErrorResponse, ErrorResponse } from '../middleware/auth';
import { 
  validateMetadataSize, 
  handleMetadataParseError, 
  handleEmptyFileError 
} from '../middleware/input-hardening';
import { CastSenseRequestMetadata } from '../types/contracts';
import { runEnrichments, canEnrich, buildContextPack } from '../services';
import { EnrichmentStatusMap, ContextPack } from '../types/enrichment';

// Initialize AJV for JSON Schema validation
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Metadata JSON Schema (from contracts/metadata.schema.json)
const metadataSchema = {
  type: 'object',
  required: ['client', 'request'],
  additionalProperties: false,
  properties: {
    client: {
      type: 'object',
      required: ['platform', 'app_version'],
      additionalProperties: false,
      properties: {
        platform: { type: 'string', enum: ['ios', 'android'] },
        app_version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+.*$' },
        device_model: { type: 'string', maxLength: 128 },
        locale: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
        timezone: { type: 'string', maxLength: 64 }
      }
    },
    request: {
      type: 'object',
      required: ['mode', 'capture_type', 'capture_timestamp_utc'],
      additionalProperties: false,
      properties: {
        mode: { type: 'string', enum: ['general', 'specific'] },
        target_species: { type: ['string', 'null'], maxLength: 64 },
        platform_context: { type: 'string', enum: ['shore', 'kayak', 'boat'] },
        gear_type: { type: 'string', enum: ['spinning', 'baitcasting', 'fly', 'unknown'] },
        capture_type: { type: 'string', enum: ['photo', 'video'] },
        capture_timestamp_utc: { type: 'string', format: 'date-time' }
      }
    },
    location: {
      type: 'object',
      required: ['lat', 'lon'],
      additionalProperties: false,
      properties: {
        lat: { type: 'number', minimum: -90, maximum: 90 },
        lon: { type: 'number', minimum: -180, maximum: 180 },
        accuracy_m: { type: 'number', minimum: 0 },
        altitude_m: { type: 'number' },
        heading_deg: { type: 'number', minimum: 0, maximum: 360 },
        speed_mps: { type: 'number', minimum: 0 }
      }
    },
    user_constraints: {
      type: 'object',
      additionalProperties: false,
      properties: {
        lures_available: { type: 'array', items: { type: 'string', maxLength: 64 } },
        line_test_lb: { type: 'number', minimum: 0, maximum: 200 },
        notes: { type: 'string', maxLength: 500 }
      }
    }
  }
};

const validateMetadata = ajv.compile(metadataSchema);

// MIME type allowlists
const PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/heic',  // Optional per spec
  'image/png'    // Optional per spec
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime'  // Optional per spec
]);

const ALL_ALLOWED_MIME_TYPES = new Set([...PHOTO_MIME_TYPES, ...VIDEO_MIME_TYPES]);

/**
 * Determines if a MIME type is for a photo
 */
function isPhotoMimeType(mimeType: string): boolean {
  return PHOTO_MIME_TYPES.has(mimeType);
}

/**
 * Determines if a MIME type is for a video
 */
function isVideoMimeType(mimeType: string): boolean {
  return VIDEO_MIME_TYPES.has(mimeType);
}

/**
 * Gets the max file size for a given MIME type
 */
function getMaxSizeForMimeType(mimeType: string): number {
  const maxPhotoBytes = parseInt(process.env.MAX_PHOTO_BYTES || '8388608', 10);  // 8MB default
  const maxVideoBytes = parseInt(process.env.MAX_VIDEO_BYTES || '26214400', 10); // 25MB default
  
  if (isPhotoMimeType(mimeType)) {
    return maxPhotoBytes;
  }
  if (isVideoMimeType(mimeType)) {
    return maxVideoBytes;
  }
  return maxPhotoBytes; // Default fallback
}

/**
 * Parsed request data from multipart form
 */
interface ParsedAnalyzeRequest {
  metadata: CastSenseRequestMetadata;
  media: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    size: number;
  };
}

/**
 * Register analyze routes
 */
export async function analyzeRoutes(fastify: FastifyInstance): Promise<void> {
  
  fastify.post('/v1/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    // Create request context with ID and timing tracker
    const ctx = createRequestContext();
    
    try {
      // Start upload parsing timer
      startTimer(ctx, 'upload_parse');
      
      // Parse and validate request
      const parsed = await parseMultipartRequest(request, ctx);
      
      if ('error' in parsed) {
        endTimer(ctx, 'upload_parse');
        endTimer(ctx, 'total');
        return reply.code(parsed.statusCode).send(parsed.error);
      }
      
      endTimer(ctx, 'upload_parse');
      
      const { metadata, media } = parsed;
      
      // T3.6: Check for missing location BEFORE running enrichments
      const locationMissing = validateLocation(metadata, ctx);
      if (locationMissing) {
        const timings = finalizeTimings(ctx);
        return reply.code(400).send({
          request_id: ctx.requestId,
          status: 'error',
          error: locationMissing,
          timings_ms: timings
        });
      }
      
      // Log successful parse
      request.log.info({
        requestId: ctx.requestId,
        captureType: metadata.request.capture_type,
        mediaSize: media.size,
        mimeType: media.mimeType
      }, 'Analyze request parsed successfully');

      // T3.2-T3.5: Run enrichments
      startTimer(ctx, 'enrichment');
      
      const timezone = metadata.client.timezone || 'UTC';
      const captureTimestamp = new Date(metadata.request.capture_timestamp_utc);
      
      const enrichmentResult = await runEnrichments(
        metadata.location!.lat,
        metadata.location!.lon,
        captureTimestamp,
        timezone
      );
      
      endTimer(ctx, 'enrichment');
      
      // T3.1: Build context pack from metadata + enrichments
      const contextPack = buildContextPack(metadata, enrichmentResult.results);
      
      // Log enrichment results
      request.log.info({
        requestId: ctx.requestId,
        enrichmentStatus: enrichmentResult.status,
        overallStatus: enrichmentResult.overallStatus
      }, 'Enrichment completed');

      // TODO: Implement remaining pipeline stages:
      // - Keyframe extraction for video (T4.x)
      // - AI calls (T5.x)
      // - Validation (T6.x)
      
      // For now, return 501 Not Implemented with timing info and context pack
      const timings = finalizeTimings(ctx);
      
      return reply.code(501).send({
        request_id: ctx.requestId,
        status: enrichmentResult.overallStatus === 'ok' ? 'ok' : 'degraded',
        rendering_mode: 'overlay',
        enrichment_status: enrichmentResult.status,
        context_pack: contextPack,
        error: {
          code: 'UNKNOWN',
          message: 'AI analysis pipeline not yet implemented',
          retryable: false,
          details: {
            parsed_metadata: metadata,
            media_info: {
              filename: media.filename,
              mime_type: media.mimeType,
              size_bytes: media.size
            }
          }
        },
        timings_ms: timings
      });
      
    } catch (err) {
      // Unexpected error
      request.log.error({ err, requestId: ctx.requestId }, 'Unexpected error in analyze route');
      
      const timings = finalizeTimings(ctx);
      
      return reply.code(500).send(createErrorResponse(
        ctx.requestId,
        'UNKNOWN',
        'An unexpected error occurred',
        true
      ));
    }
  });
}

/**
 * T3.6: Validate that location data is present and valid
 * Returns an error object if location is missing/invalid, null otherwise
 */
function validateLocation(
  metadata: CastSenseRequestMetadata,
  ctx: RequestContext
): { code: string; message: string; retryable: boolean } | null {
  const { location } = metadata;

  // Check if location object is missing entirely
  if (!location) {
    return {
      code: 'NO_GPS',
      message: 'Location required. Please enable GPS permissions.',
      retryable: false
    };
  }

  // Check if lat/lon are missing or invalid
  if (location.lat === undefined || location.lon === undefined) {
    return {
      code: 'NO_GPS',
      message: 'Location required. Please enable GPS permissions.',
      retryable: false
    };
  }

  // Validate lat/lon ranges
  if (location.lat < -90 || location.lat > 90) {
    return {
      code: 'NO_GPS',
      message: 'Invalid latitude. Value must be between -90 and 90.',
      retryable: false
    };
  }

  if (location.lon < -180 || location.lon > 180) {
    return {
      code: 'NO_GPS',
      message: 'Invalid longitude. Value must be between -180 and 180.',
      retryable: false
    };
  }

  // Location is valid
  return null;
}

/**
 * Parse multipart request, validate metadata and media
 */
async function parseMultipartRequest(
  request: FastifyRequest,
  ctx: RequestContext
): Promise<ParsedAnalyzeRequest | { error: ErrorResponse; statusCode: number }> {
  
  let metadata: CastSenseRequestMetadata | null = null;
  let mediaBuffer: Buffer | null = null;
  let mediaFilename = '';
  let mediaMimeType = '';

  // Get client identifier for tracking
  const authHeader = request.headers.authorization;
  const clientId = authHeader && authHeader.startsWith('Bearer ') 
    ? `key:${authHeader.substring(7, 15)}`
    : `ip:${request.ip}`;
  
  try {
    // Check content type
    const contentType = request.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        error: createErrorResponse(
          ctx.requestId,
          'INVALID_MEDIA',
          'Content-Type must be multipart/form-data',
          false
        )
      };
    }

    // Parse multipart parts
    const parts = request.parts();
    
    for await (const part of parts) {
      if (part.type === 'field') {
        // Handle metadata field
        if (part.fieldname === 'metadata') {
          const metadataString = part.value as string;
          
          // T6.3: Validate metadata size before parsing
          const sizeError = validateMetadataSize(metadataString, ctx.requestId, clientId);
          if (sizeError) {
            return {
              statusCode: 400,
              error: sizeError as ErrorResponse
            };
          }

          try {
            metadata = JSON.parse(metadataString);
          } catch (parseErr) {
            // T6.3: Handle metadata parse error with rate limiting
            const parseError = handleMetadataParseError(parseErr as Error, ctx.requestId, clientId);
            return {
              statusCode: parseError.error.code === 'RATE_LIMITED' ? 429 : 400,
              error: parseError as ErrorResponse
            };
          }
        }
      } else if (part.type === 'file') {
        // Handle media file
        if (part.fieldname === 'media') {
          mediaFilename = part.filename;
          mediaMimeType = part.mimetype;
          
          // Validate MIME type before consuming buffer
          if (!ALL_ALLOWED_MIME_TYPES.has(mediaMimeType)) {
            // Consume the stream to avoid hanging
            await part.toBuffer();
            return {
              statusCode: 400,
              error: createErrorResponse(
                ctx.requestId,
                'INVALID_MEDIA',
                `Unsupported media type: ${mediaMimeType}. Allowed: ${Array.from(ALL_ALLOWED_MIME_TYPES).join(', ')}`,
                false
              )
            };
          }
          
          // Read file buffer
          mediaBuffer = await part.toBuffer();
          
          // T6.3: Check for empty file
          if (mediaBuffer.length === 0) {
            const emptyError = handleEmptyFileError(ctx.requestId, 'media');
            return {
              statusCode: 400,
              error: emptyError as ErrorResponse
            };
          }
          
          // Check file size against limits
          const maxSize = getMaxSizeForMimeType(mediaMimeType);
          if (mediaBuffer.length > maxSize) {
            const mediaType = isPhotoMimeType(mediaMimeType) ? 'photo' : 'video';
            return {
              statusCode: 400,
              error: createErrorResponse(
                ctx.requestId,
                'INVALID_MEDIA',
                `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} exceeds maximum size of ${maxSize} bytes`,
                false,
                { 
                  actual_size: mediaBuffer.length,
                  max_size: maxSize,
                  media_type: mediaType
                }
              )
            };
          }
        }
      }
    }
    
  } catch (err) {
    request.log.error({ err, requestId: ctx.requestId }, 'Error parsing multipart request');
    return {
      statusCode: 400,
      error: createErrorResponse(
        ctx.requestId,
        'INVALID_MEDIA',
        'Failed to parse multipart form data',
        false,
        { details: (err as Error).message }
      )
    };
  }

  // Validate required fields
  if (!metadata) {
    return {
      statusCode: 400,
      error: createErrorResponse(
        ctx.requestId,
        'INVALID_MEDIA',
        'Missing required field: metadata',
        false
      )
    };
  }

  if (!mediaBuffer) {
    return {
      statusCode: 400,
      error: createErrorResponse(
        ctx.requestId,
        'INVALID_MEDIA',
        'Missing required field: media',
        false
      )
    };
  }

  // Validate metadata against schema
  const valid = validateMetadata(metadata);
  if (!valid) {
    return {
      statusCode: 400,
      error: createErrorResponse(
        ctx.requestId,
        'INVALID_MEDIA',
        'Metadata validation failed',
        false,
        { validation_errors: validateMetadata.errors }
      )
    };
  }

  // Validate capture_type matches media MIME type
  const declaredCaptureType = metadata.request.capture_type;
  const actualIsPhoto = isPhotoMimeType(mediaMimeType);
  const actualIsVideo = isVideoMimeType(mediaMimeType);
  
  if (declaredCaptureType === 'photo' && !actualIsPhoto) {
    return {
      statusCode: 400,
      error: createErrorResponse(
        ctx.requestId,
        'INVALID_MEDIA',
        `Metadata declares capture_type as 'photo' but media MIME type is ${mediaMimeType}`,
        false
      )
    };
  }
  
  if (declaredCaptureType === 'video' && !actualIsVideo) {
    return {
      statusCode: 400,
      error: createErrorResponse(
        ctx.requestId,
        'INVALID_MEDIA',
        `Metadata declares capture_type as 'video' but media MIME type is ${mediaMimeType}`,
        false
      )
    };
  }

  return {
    metadata: metadata as CastSenseRequestMetadata,
    media: {
      buffer: mediaBuffer,
      filename: mediaFilename,
      mimeType: mediaMimeType,
      size: mediaBuffer.length
    }
  };
}

export default analyzeRoutes;
