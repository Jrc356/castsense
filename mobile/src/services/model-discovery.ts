/**
 * Model Discovery Service
 * 
 * Fetches available models from OpenAI's API.
 * Filters models by their actual API-reported capabilities and sorts by creation date.
 */

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  // Capabilities reported by the API
  capabilities?: {
    vision?: boolean;
    [key: string]: boolean | undefined;
  };
  [key: string]: unknown;
}

interface OpenAIModelsResponse {
  object: string;
  data: OpenAIModel[];
}

/**
 * Get sort priority for a model based on its family and capabilities
 * Higher number = higher priority (shown first)
 */
function getModelPriority(modelId: string): number {
  const id = modelId.toLowerCase();
  
  // Latest/best models first
  if (id.startsWith('gpt-5')) return 5000;    // GPT-5 family
  if (id.startsWith('o4')) return 4500;       // O4 (if exists)
  if (id.startsWith('o3')) return 4000;       // O3 reasoning
  if (id.startsWith('o1')) return 3500;       // O1 reasoning
  if (id.startsWith('gpt-4o')) return 3000;   // GPT-4o (vision)
  if (id.startsWith('gpt-4')) return 2000;    // GPT-4 family
  if (id.startsWith('gpt-3')) return 1000;    // GPT-3.5 family
  
  return 0; // Unknown models
}

/**
 * Check if a model is a base chat/vision model worth showing
 * Prioritizes API-reported capabilities, falls back to ID-based filtering
 * Filters out:
 * - Non-chat model types (embedding, image, audio, moderation, etc.)
 * - Preview models with non-standard naming
 * - Specialized variants (audio, realtime, search, transcribe, tts, etc.)
 */
function isChatModel(model: OpenAIModel): boolean {
  const id = model.id.toLowerCase();
  
  // Exclude specific non-chat model types by ID pattern
  const excludePatterns = [
    'embedding',      // text-embedding-*
    'dall-e',         // image generation
    'tts-',           // text-to-speech
    'whisper',        // audio transcription
    'moderation',     // content moderation
    'codex',          // legacy code model
    'instruct',       // instruction-tuned text models
    'davinci',        // legacy base model
    'babbage',        // legacy base model
    'curie',          // legacy model
    'ada',            // legacy model
    'sora',           // video generation
    'audio',          // audio variants
    'realtime',       // realtime API models
    'search',         // search variants
    'transcribe',     // transcription variants
  ];
  
  if (excludePatterns.some(pattern => id.includes(pattern))) {
    return false;
  }
  
  // For models with explicit capabilities, check if they support chat
  // If capabilities are reported, use them; otherwise trust the model name
  if (model.capabilities && typeof model.capabilities === 'object') {
    // Model doesn't have any chat-like capability
    const hasChatCapability = model.capabilities.chat !== false;
    const hasVisionCapability = model.capabilities.vision !== false;
    const hasReasoningCapability = model.capabilities.reasoning !== false;
    
    // Include if it has chat or vision or reasoning capabilities
    if (hasChatCapability || hasVisionCapability || hasReasoningCapability) {
      return true;
    }
    
    // If capabilities are explicitly set but none match, exclude it
    if (Object.keys(model.capabilities).length > 0) {
      return false;
    }
  }
  
  // Fallback: exclude models with explicit dated versions or -latest suffix
  if (id.match(/-202[4-9]-/) || id.endsWith('-latest')) {
    return false;
  }
  
  // Trust that base model names (gpt-4, gpt-5, o1, o3, etc.) are chat models
  return true;
}

/**
 * Retry configuration for model fetching
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attempt: number): number {
  // Exponential backoff: 500ms, 1000ms, 2000ms (capped at 5000ms)
  const delay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt - 1),
    RETRY_CONFIG.maxDelayMs
  );
  // Add ±10% jitter to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Fetch available base chat and vision models from OpenAI API
 * Sorted by model tier (newest/best first) then by creation date within tier
 * Retries up to 3 times with exponential backoff on network errors
 * @param apiKey - User's OpenAI API key
 * @returns Array of model IDs sorted by tier and creation date
 * @throws Error if API call fails after all retries or on non-retryable errors
 */
export async function fetchAvailableModels(
  apiKey: string,
  capability?: string // Kept for backwards compatibility but not used
): Promise<string[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'CastSense-Mobile/1.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error (attempt ${attempt}): ${response.status}`, errorText);
        
        if (response.status === 401) {
          // Non-retryable: invalid API key
          throw new Error('Invalid API key - please check your OpenAI API key');
        }
        if (response.status === 429) {
          // Retryable: rate limited
          const error = new Error('Rate limited - please try again in a moment');
          (error as any).retryable = true;
          throw error;
        }
        if (response.status >= 500) {
          // Retryable: server error
          const error = new Error(`OpenAI API server error (${response.status})`);
          (error as any).retryable = true;
          throw error;
        }
        // Non-retryable: client error
        throw new Error(`OpenAI API returned ${response.status}`);
      }

      const data: OpenAIModelsResponse = await response.json();

      // Filter to base chat/vision models and sort by tier, then creation date
      const availableModels = data.data
        .filter((model) => isChatModel(model))
        .sort((a, b) => {
          // First sort by priority (tier)
          const priorityDiff = getModelPriority(b.id) - getModelPriority(a.id);
          if (priorityDiff !== 0) return priorityDiff;
          
          // Within same tier, sort by creation date (newest first)
          return b.created - a.created;
        })
        .map((model) => model.id);

      return availableModels;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = (error as any).retryable || error instanceof TypeError;
      
      console.error(
        `Failed to fetch available models (attempt ${attempt}/${RETRY_CONFIG.maxRetries}):`,
        error
      );

      // Don't retry on non-retryable errors
      if (!isRetryable) {
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt === RETRY_CONFIG.maxRetries) {
        const finalError = new Error(
          'Failed to connect to OpenAI API after multiple attempts. Please check your internet connection and try again.'
        );
        (finalError as any).originalError = lastError;
        throw finalError;
      }

      // Wait before retrying with exponential backoff
      const delayMs = getBackoffDelay(attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // This should never be reached, but just in case
  throw lastError || new Error('Failed to fetch available models');
}
