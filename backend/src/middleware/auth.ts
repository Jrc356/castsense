/**
 * Authentication Middleware
 * 
 * API key validation per §10.1
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Error codes per §10.1
 */
export type ErrorCode = 
  | 'NO_GPS' 
  | 'NO_NETWORK' 
  | 'INVALID_MEDIA' 
  | 'AI_TIMEOUT' 
  | 'ENRICHMENT_FAILED' 
  | 'UNAUTHORIZED' 
  | 'RATE_LIMITED'
  | 'UNKNOWN';

/**
 * Standard error response structure per §10.1
 */
export interface ErrorResponse {
  request_id: string;
  status: 'error';
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

/**
 * Creates a standard error response
 */
export function createErrorResponse(
  requestId: string,
  code: ErrorResponse['error']['code'],
  message: string,
  retryable: boolean,
  details?: Record<string, unknown>
): ErrorResponse {
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
 * Paths that do not require authentication
 */
const PUBLIC_PATHS = [
  '/v1/health'
];

/**
 * Checks if a path is public (no auth required)
 */
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(publicPath => path === publicPath || path.startsWith(publicPath + '/'));
}

/**
 * Authentication middleware hook
 * Validates API key from Authorization header
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip auth for public paths
  if (isPublicPath(request.url)) {
    return;
  }

  const apiKey = process.env.API_KEY;
  
  // If no API_KEY is configured, skip auth (development mode)
  if (!apiKey) {
    request.log.warn('API_KEY not configured - authentication disabled');
    return;
  }

  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    reply.code(401).send(createErrorResponse(
      uuidv4(),
      'UNAUTHORIZED',
      'Missing Authorization header',
      false
    ));
    return;
  }

  // Expect "Bearer <token>" format
  const parts = authHeader.split(' ');
  const authType = parts[0];
  const token = parts[1];
  
  if (parts.length !== 2 || !authType || authType.toLowerCase() !== 'bearer') {
    reply.code(401).send(createErrorResponse(
      uuidv4(),
      'UNAUTHORIZED',
      'Invalid Authorization header format. Expected: Bearer <token>',
      false
    ));
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!token || !constantTimeCompare(token, apiKey)) {
    reply.code(401).send(createErrorResponse(
      uuidv4(),
      'UNAUTHORIZED',
      'Invalid API key',
      false
    ));
    return;
  }

  // Auth successful
  return;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
