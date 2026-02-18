/**
 * AI Types
 * 
 * Types for AI provider client, prompting, and orchestration (T4.x)
 */

/**
 * Options for making an AI call
 */
export interface AICallOptions {
  /** Timeout in milliseconds */
  timeout_ms: number;
  /** Optional model override (defaults to AI_MODEL env var) */
  model?: string;
}

/**
 * Response from an AI call
 */
export interface AIResponse {
  /** The raw content from the model (typically JSON string) */
  content: string;
  /** Model identifier used for this call */
  model: string;
  /** Token usage statistics if available */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Result from Stage 1 "Perception" prompt
 * Structured observations about the scene
 */
export interface PerceptionResult {
  /** High-level observations about the scene */
  scene_observations: string[];
  /** Identified structure elements */
  structure_elements: Array<{
    /** Type of structure (e.g., "weed_line", "rock_pile", "drop_off") */
    type: string;
    /** Approximate location in the image (e.g., "upper left", "center right") */
    location_hint: string;
    /** Confidence in this detection (0-1) */
    confidence: number;
  }>;
  /** Water condition observations */
  water_conditions: {
    /** Water clarity assessment */
    clarity: string;
    /** Current/flow assessment */
    current: string;
  };
  /** Any visible constraints or hazards */
  constraints: string[];
}

/**
 * Result from the complete AI analysis pipeline
 */
export interface AIAnalysisResult {
  /** The parsed JSON result matching CastSenseAnalysisResult schema */
  result: unknown;
  /** Model identifier used for the final output */
  model: string;
  /** Timing breakdown of AI stages */
  timings: {
    /** Duration of perception stage (two-stage only) */
    perception_ms?: number;
    /** Duration of planning stage (two-stage only) */
    planning_ms?: number;
    /** Total AI processing time */
    total_ms: number;
  };
  /** Raw response for debugging if needed */
  raw_response?: string;
}

/**
 * Error codes for AI-related failures
 */
export type AIErrorCode = 
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_PARSE_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'AI_NETWORK_ERROR';

/**
 * Structured AI error
 */
export interface AIError extends Error {
  /** Error code for categorization */
  code: AIErrorCode;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Additional error context */
  details?: Record<string, unknown>;
}

/**
 * Image content for multimodal AI input
 */
export interface ImageContent {
  /** Base64-encoded image data */
  data: string;
  /** MIME type of the image */
  mimeType: string;
}

/**
 * Message structure for OpenAI-compatible API
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

/**
 * Configuration for the AI client
 */
export interface AIClientConfig {
  /** API key for the AI provider */
  apiKey: string;
  /** Base URL for the API (default: https://api.openai.com/v1) */
  baseUrl: string;
  /** Default model to use */
  model: string;
  /** Timeout for photo analysis */
  timeoutMsPhoto: number;
  /** Timeout for video analysis */
  timeoutMsVideo: number;
}
