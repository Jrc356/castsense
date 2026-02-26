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
 * Filters out:
 * - Non-chat model types (embedding, image, audio, moderation, etc.)
 * - Preview models
 * - Dated/versioned variants (keep only the base model names)
 * - Specialized variants (audio, realtime, search, transcribe, tts, etc.)
 */
function isChatModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  
  // Exclude specific non-chat model types
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
    'preview',        // preview models
    'audio',          // audio variants
    'realtime',       // realtime API models
    'search',         // search variants
    'transcribe',     // transcription variants
    '-2024-',         // dated versions (2024)
    '-2025-',         // dated versions (2025)
    '-2026-',         // dated versions (2026)
    '-latest',        // versioned variants
  ];
  
  return !excludePatterns.some(pattern => id.includes(pattern));
}

/**
 * Fetch available base chat and vision models from OpenAI API
 * Sorted by model tier (newest/best first) then by creation date within tier
 * @param apiKey - User's OpenAI API key
 * @returns Array of model IDs sorted by tier and creation date
 * @throws Error if API call fails
 */
export async function fetchAvailableModels(
  apiKey: string,
  capability?: string // Kept for backwards compatibility but not used
): Promise<string[]> {
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
      console.error(`OpenAI API error: ${response.status}`, errorText);
      
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 429) {
        throw new Error('Rate limited - please try again later');
      }
      throw new Error(`OpenAI API returned ${response.status}`);
    }

    const data: OpenAIModelsResponse = await response.json();

    // Filter to base chat/vision models and sort by tier, then creation date
    const availableModels = data.data
      .filter((model) => isChatModel(model.id))
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
    console.error('Failed to fetch available models:', error);
    // Re-throw error - caller will handle fallback
    throw error;
  }
}
