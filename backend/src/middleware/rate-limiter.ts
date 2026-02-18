/**
 * Rate Limiter Middleware
 * 
 * Per-API-key rate limiting with RPM and concurrency caps
 * Implements T6.1 requirements
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Rate limit info tracked per API key
 */
interface RateLimitInfo {
  /** Timestamps of requests in current window */
  requestTimestamps: number[];
  /** Number of currently active (in-flight) requests */
  activeRequests: number;
  /** Last activity timestamp for cleanup */
  lastActivity: number;
}

/**
 * Standard error response for rate limiting
 */
interface RateLimitErrorResponse {
  request_id: string;
  status: 'error';
  error: {
    code: 'RATE_LIMITED';
    message: string;
    retryable: boolean;
  };
}

/**
 * In-memory rate limit store
 * Maps API key (or IP for unauthenticated) to rate limit info
 */
const rateLimitStore = new Map<string, RateLimitInfo>();

/**
 * Configuration from environment
 */
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '60', 10);
const RATE_LIMIT_CONCURRENCY = parseInt(process.env.RATE_LIMIT_CONCURRENCY || '5', 10);
const WINDOW_MS = 60 * 1000; // 1 minute window
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every minute

/**
 * Paths that are exempt from rate limiting
 */
const EXEMPT_PATHS = [
  '/v1/health'
];

/**
 * Check if a path is exempt from rate limiting
 */
function isExemptPath(path: string): boolean {
  return EXEMPT_PATHS.some(exempt => path === exempt || path.startsWith(exempt + '/'));
}

/**
 * Extract rate limit key from request
 * Uses API key if present, falls back to IP address
 */
function getRateLimitKey(request: FastifyRequest): string {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Use a hash/truncation of the API key to avoid storing full keys
    const token = authHeader.substring(7);
    return `key:${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
  }
  // Fall back to IP address
  return `ip:${request.ip}`;
}

/**
 * Create rate limit error response
 */
function createRateLimitError(requestId: string, message: string): RateLimitErrorResponse {
  return {
    request_id: requestId,
    status: 'error',
    error: {
      code: 'RATE_LIMITED',
      message,
      retryable: true
    }
  };
}

/**
 * Calculate Retry-After value in seconds
 */
function calculateRetryAfter(info: RateLimitInfo): number {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  
  // Find the oldest request in the current window
  const oldestInWindow = info.requestTimestamps.find(ts => ts > windowStart);
  
  if (oldestInWindow) {
    // Calculate when that oldest request will expire from the window
    const retryAfterMs = (oldestInWindow + WINDOW_MS) - now;
    return Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
  
  // Default to 1 second if we can't calculate
  return 1;
}

/**
 * Clean up old entries from rate limit store
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  const cutoff = now - (WINDOW_MS * 2); // Keep entries for 2 windows

  for (const [key, info] of rateLimitStore.entries()) {
    // Remove entries with no active requests and no recent activity
    if (info.activeRequests === 0 && info.lastActivity < cutoff) {
      rateLimitStore.delete(key);
    } else {
      // Clean up old timestamps
      info.requestTimestamps = info.requestTimestamps.filter(ts => ts > now - WINDOW_MS);
    }
  }
}

// Start periodic cleanup
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the cleanup interval
 */
export function startRateLimitCleanup(): void {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupOldEntries, CLEANUP_INTERVAL_MS);
    // Don't prevent process from exiting
    cleanupInterval.unref();
  }
}

/**
 * Stop the cleanup interval (for testing/shutdown)
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Clear rate limit store (for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Rate limiter middleware hook
 * Enforces per-key RPM and concurrency limits
 */
export async function rateLimiterMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip rate limiting for exempt paths
  if (isExemptPath(request.url)) {
    return;
  }

  const key = getRateLimitKey(request);
  const now = Date.now();
  const requestId = uuidv4();

  // Get or create rate limit info for this key
  let info = rateLimitStore.get(key);
  if (!info) {
    info = {
      requestTimestamps: [],
      activeRequests: 0,
      lastActivity: now
    };
    rateLimitStore.set(key, info);
  }

  // Clean up old timestamps from this key's window
  const windowStart = now - WINDOW_MS;
  info.requestTimestamps = info.requestTimestamps.filter(ts => ts > windowStart);
  info.lastActivity = now;

  // Check RPM limit
  if (info.requestTimestamps.length >= RATE_LIMIT_RPM) {
    const retryAfter = calculateRetryAfter(info);
    
    request.log.warn({
      key,
      requestCount: info.requestTimestamps.length,
      limit: RATE_LIMIT_RPM,
      retryAfter
    }, 'Rate limit exceeded (RPM)');

    reply
      .code(429)
      .header('Retry-After', retryAfter.toString())
      .send(createRateLimitError(requestId, 'Rate limit exceeded. Try again later.'));
    return;
  }

  // Check concurrency limit
  if (info.activeRequests >= RATE_LIMIT_CONCURRENCY) {
    request.log.warn({
      key,
      activeRequests: info.activeRequests,
      limit: RATE_LIMIT_CONCURRENCY
    }, 'Concurrency limit exceeded');

    reply
      .code(429)
      .header('Retry-After', '1')
      .send(createRateLimitError(requestId, 'Too many concurrent requests. Try again later.'));
    return;
  }

  // Record this request
  info.requestTimestamps.push(now);
  info.activeRequests++;

  // Set up response hook to decrement active requests when done
  reply.raw.on('finish', () => {
    const currentInfo = rateLimitStore.get(key);
    if (currentInfo) {
      currentInfo.activeRequests = Math.max(0, currentInfo.activeRequests - 1);
    }
  });

  // Also handle premature connection close
  reply.raw.on('close', () => {
    const currentInfo = rateLimitStore.get(key);
    if (currentInfo && currentInfo.activeRequests > 0) {
      currentInfo.activeRequests = Math.max(0, currentInfo.activeRequests - 1);
    }
  });

  return;
}

// Auto-start cleanup on module load
startRateLimitCleanup();
