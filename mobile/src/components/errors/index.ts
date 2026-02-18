/**
 * Error Component Exports
 * 
 * Centralized exports for all error view components
 */

export {LocationErrorView} from './LocationErrorView';
export type {LocationErrorViewProps} from './LocationErrorView';

export {NetworkErrorView} from './NetworkErrorView';
export type {NetworkErrorViewProps} from './NetworkErrorView';

export {ServerErrorView} from './ServerErrorView';
export type {ServerErrorViewProps, ServerErrorCode} from './ServerErrorView';

export {MediaErrorView} from './MediaErrorView';
export type {MediaErrorViewProps} from './MediaErrorView';

export {RateLimitView} from './RateLimitView';
export type {RateLimitViewProps} from './RateLimitView';

// ─────────────────────────────────────────────────────────────────────────────
// Error Messages Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ErrorMessageConfig {
  title: string;
  message: string;
  actionLabel: string;
}

export const ERROR_MESSAGES: Record<string, ErrorMessageConfig> = {
  NO_GPS: {
    title: 'Location Required',
    message: 'CastSense needs your location to analyze fishing conditions. Please enable GPS.',
    actionLabel: 'Open Settings',
  },
  NO_NETWORK: {
    title: 'No Connection',
    message: 'Unable to reach the server. Check your internet connection.',
    actionLabel: 'Retry',
  },
  AI_TIMEOUT: {
    title: 'Analysis Timeout',
    message: 'The analysis is taking longer than expected. Please try again.',
    actionLabel: 'Retry',
  },
  ENRICHMENT_FAILED: {
    title: 'Partial Data',
    message: 'Some environmental data could not be retrieved. Results may be limited.',
    actionLabel: 'View Results',
  },
  INVALID_MEDIA: {
    title: 'Invalid Photo/Video',
    message: 'The captured media could not be processed. Please try capturing again.',
    actionLabel: 'Recapture',
  },
  RATE_LIMITED: {
    title: 'Too Many Requests',
    message: 'Please wait a moment before trying again.',
    actionLabel: 'Retry',
  },
  UNAUTHORIZED: {
    title: 'Authentication Error',
    message: 'Unable to authenticate. Please restart the app.',
    actionLabel: 'Restart',
  },
  CAPTURE_FAILED: {
    title: 'Capture Failed',
    message: 'Unable to capture photo or video. Please try again.',
    actionLabel: 'Retry',
  },
  UPLOAD_FAILED: {
    title: 'Upload Failed',
    message: 'Unable to upload your media. Please check your connection.',
    actionLabel: 'Retry',
  },
  UNKNOWN: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
    actionLabel: 'Retry',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Error Type Detection
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorType = 
  | 'location'
  | 'network'
  | 'server'
  | 'media'
  | 'rate_limit'
  | 'unknown';

/**
 * Determine the error type from error code
 * Used to route to the appropriate error view
 */
export function getErrorType(errorCode: string): ErrorType {
  switch (errorCode) {
    case 'NO_GPS':
      return 'location';
    
    case 'NO_NETWORK':
    case 'TIMEOUT':
    case 'UPLOAD_FAILED':
      return 'network';
    
    case 'AI_TIMEOUT':
    case 'ENRICHMENT_FAILED':
    case 'UNKNOWN':
    case 'UNAUTHORIZED':
      return 'server';
    
    case 'INVALID_MEDIA':
    case 'CAPTURE_FAILED':
      return 'media';
    
    case 'RATE_LIMITED':
      return 'rate_limit';
    
    default:
      return 'unknown';
  }
}
