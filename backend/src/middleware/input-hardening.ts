/**
 * Input Hardening Middleware
 * 
 * Implements T6.3 requirements for structured input validation
 * - Content-type enforcement
 * - Metadata size limits
 * - Malformed input protection
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Standard error response structure
 */
interface InputHardeningErrorResponse {
  request_id: string;
  status: 'error';
  error: {
    code: 'INVALID_MEDIA' | 'RATE_LIMITED';
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

/**
 * Configuration from environment
 */
const MAX_METADATA_BYTES = parseInt(process.env.MAX_METADATA_BYTES || '10240', 10); // 10KB default

/**
 * Metadata parse attempt tracking for rate limiting
 * Maps client identifier to recent failed parse attempts
 */
interface ParseAttemptInfo {
  failedAttempts: number[];
  lastActivity: number;
}

const parseAttemptStore = new Map<string, ParseAttemptInfo>();

// Rate limiting config for metadata parsing
const PARSE_ATTEMPT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_FAILED_PARSE_ATTEMPTS = 10; // Max failed attempts per minute
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Get client identifier for tracking
 */
function getClientIdentifier(request: FastifyRequest): string {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return `key:${token.substring(0, 8)}`;
  }
  return `ip:${request.ip}`;
}

/**
 * Create error response for input hardening
 */
function createInputError(
  requestId: string,
  code: 'INVALID_MEDIA' | 'RATE_LIMITED',
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>
): InputHardeningErrorResponse {
  return {
    request_id: requestId,
    status: 'error',
    error: {
      code,
      message,
      retryable,
      ...(details && { details })
    }
  };
}

/**
 * Track failed metadata parse attempt
 * Returns true if client should be rate limited
 */
function trackFailedParseAttempt(clientId: string): boolean {
  const now = Date.now();
  const windowStart = now - PARSE_ATTEMPT_WINDOW_MS;

  let info = parseAttemptStore.get(clientId);
  if (!info) {
    info = {
      failedAttempts: [],
      lastActivity: now
    };
    parseAttemptStore.set(clientId, info);
  }

  // Clean old attempts
  info.failedAttempts = info.failedAttempts.filter(ts => ts > windowStart);
  info.lastActivity = now;

  // Check if already at limit
  if (info.failedAttempts.length >= MAX_FAILED_PARSE_ATTEMPTS) {
    return true;
  }

  // Record this attempt
  info.failedAttempts.push(now);

  // Return true if now at limit
  return info.failedAttempts.length >= MAX_FAILED_PARSE_ATTEMPTS;
}

/**
 * Check if client is rate limited for parse attempts
 */
function isParseRateLimited(clientId: string): boolean {
  const now = Date.now();
  const windowStart = now - PARSE_ATTEMPT_WINDOW_MS;

  const info = parseAttemptStore.get(clientId);
  if (!info) {
    return false;
  }

  // Clean and count
  const recentAttempts = info.failedAttempts.filter(ts => ts > windowStart);
  return recentAttempts.length >= MAX_FAILED_PARSE_ATTEMPTS;
}

/**
 * Clean up old parse attempt records
 */
function cleanupParseAttempts(): void {
  const now = Date.now();
  const cutoff = now - (PARSE_ATTEMPT_WINDOW_MS * 2);

  for (const [key, info] of parseAttemptStore.entries()) {
    if (info.lastActivity < cutoff) {
      parseAttemptStore.delete(key);
    }
  }
}

// Start periodic cleanup
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start cleanup interval
 */
export function startInputHardeningCleanup(): void {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupParseAttempts, CLEANUP_INTERVAL_MS);
    cleanupInterval.unref();
  }
}

/**
 * Stop cleanup interval
 */
export function stopInputHardeningCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear parse attempt store (for testing)
 */
export function clearParseAttemptStore(): void {
  parseAttemptStore.clear();
}

/**
 * Input hardening middleware for analyze route
 * Enforces content-type and basic input validation
 */
export async function inputHardeningMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = uuidv4();
  const clientId = getClientIdentifier(request);

  // Check if client is rate limited for parse attempts
  if (isParseRateLimited(clientId)) {
    request.log.warn({ clientId }, 'Client rate limited for metadata parse attempts');
    reply
      .code(429)
      .header('Retry-After', '60')
      .send(createInputError(
        requestId,
        'RATE_LIMITED',
        'Too many malformed requests. Try again later.',
        true
      ));
    return;
  }

  // Check Content-Type for analyze endpoint
  const contentType = request.headers['content-type'] || '';
  
  if (!contentType.includes('multipart/form-data')) {
    request.log.warn({
      requestId,
      contentType,
      expected: 'multipart/form-data'
    }, 'Invalid content type for analyze endpoint');

    // Track as failed attempt
    trackFailedParseAttempt(clientId);

    reply.code(400).send(createInputError(
      requestId,
      'INVALID_MEDIA',
      'Content-Type must be multipart/form-data',
      false,
      { received_content_type: contentType }
    ));
    return;
  }

  // Check Content-Length if present (early rejection for oversized requests)
  const contentLength = request.headers['content-length'];
  if (contentLength) {
    const length = parseInt(contentLength, 10);
    const maxRequestSize = parseInt(process.env.MAX_VIDEO_BYTES || '26214400', 10) + MAX_METADATA_BYTES + 1024; // Allow buffer for multipart boundaries
    
    if (length > maxRequestSize) {
      request.log.warn({
        requestId,
        contentLength: length,
        maxAllowed: maxRequestSize
      }, 'Request too large');

      reply.code(413).send(createInputError(
        requestId,
        'INVALID_MEDIA',
        'Request payload too large',
        false,
        { max_size_bytes: maxRequestSize, received_size_bytes: length }
      ));
      return;
    }
  }

  // Store metadata size limit in request for downstream validation
  (request as FastifyRequest & { maxMetadataBytes?: number }).maxMetadataBytes = MAX_METADATA_BYTES;

  return;
}

/**
 * Validate metadata size (to be called during multipart parsing)
 * Returns error response if metadata is too large, null otherwise
 */
export function validateMetadataSize(
  metadataString: string,
  requestId: string,
  clientId: string
): InputHardeningErrorResponse | null {
  const metadataBytes = Buffer.byteLength(metadataString, 'utf8');
  
  if (metadataBytes > MAX_METADATA_BYTES) {
    // Track as abuse attempt
    trackFailedParseAttempt(clientId);
    
    return createInputError(
      requestId,
      'INVALID_MEDIA',
      `Metadata exceeds maximum size of ${MAX_METADATA_BYTES} bytes`,
      false,
      { max_size_bytes: MAX_METADATA_BYTES, received_size_bytes: metadataBytes }
    );
  }

  return null;
}

/**
 * Handle metadata parse error
 * Returns standardized error response
 */
export function handleMetadataParseError(
  parseError: Error,
  requestId: string,
  clientId: string
): InputHardeningErrorResponse {
  // Track failed parse attempt
  const isRateLimited = trackFailedParseAttempt(clientId);

  if (isRateLimited) {
    return createInputError(
      requestId,
      'RATE_LIMITED',
      'Too many malformed requests. Try again later.',
      true
    );
  }

  return createInputError(
    requestId,
    'INVALID_MEDIA',
    'Invalid JSON in metadata field',
    false,
    { parse_error: parseError.message }
  );
}

/**
 * Handle empty file error
 */
export function handleEmptyFileError(
  requestId: string,
  fieldName: string
): InputHardeningErrorResponse {
  return createInputError(
    requestId,
    'INVALID_MEDIA',
    `Empty file received for field: ${fieldName}`,
    false
  );
}

// Auto-start cleanup on module load
startInputHardeningCleanup();
