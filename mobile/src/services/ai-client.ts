/**
 * AI Client Service (Mobile)
 * 
 * Handles OpenAI vision API calls for fishing analysis.
 * Uses user's API key for BYO-API-key model.
 */

import OpenAI from 'openai';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import { EnrichmentResults } from './enrichment';

const AI_TIMEOUT_MS_PHOTO = 12000;
const AI_MODEL = 'gpt-4o';

// ============================================================================
// Types
// ============================================================================

export interface ContextPack {
  mode: 'general' | 'specific';
  target_species?: string | null;
  location?: {
    lat: number;
    lon: number;
    waterbody_name?: string | null;
    water_type?: string;
    admin_area?: string | null;
    country?: string | null;
  };
  time?: {
    local_time: string;
    season: string;
    sunrise_local: string;
    sunset_local: string;
    daylight_phase: string;
  };
  weather?: {
    air_temp_f: number;
    wind_speed_mph: number;
    wind_direction_deg: number;
    cloud_cover_pct: number;
    pressure_inhg: number;
    pressure_trend: string;
    precip_last_24h_in: number;
  };
  user_context?: {
    platform?: string;
    gear_type?: string;
  };
}

export interface AnalysisOptions {
  mode: 'general' | 'specific';
  targetSpecies?: string;
  platform?: 'shore' | 'kayak' | 'boat';
  gearType?: 'spinning' | 'baitcasting' | 'fly' | 'unknown';
}

export interface AIAnalysisResult {
  result: unknown;
  model: string;
  rawResponse: string;
}

// ============================================================================
// Context Pack Builder
// ============================================================================

function buildContextPack(
  enrichment: EnrichmentResults,
  location: { lat: number; lon: number },
  options: AnalysisOptions
): ContextPack {
  const contextPack: ContextPack = {
    mode: options.mode,
    target_species: options.targetSpecies || null
  };

  // Location
  if (enrichment.reverseGeocode) {
    contextPack.location = {
      lat: location.lat,
      lon: location.lon,
      waterbody_name: enrichment.reverseGeocode.waterbody_name,
      water_type: enrichment.reverseGeocode.water_type,
      admin_area: enrichment.reverseGeocode.admin_area,
      country: enrichment.reverseGeocode.country
    };
  }

  // Time
  if (enrichment.solar) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    contextPack.time = {
      local_time: formatter.format(now),
      season: enrichment.solar.season,
      sunrise_local: enrichment.solar.sunrise_local,
      sunset_local: enrichment.solar.sunset_local,
      daylight_phase: enrichment.solar.daylight_phase
    };
  }

  // Weather
  if (enrichment.weather) {
    contextPack.weather = {
      air_temp_f: enrichment.weather.temperature_f,
      wind_speed_mph: enrichment.weather.wind_speed_mph,
      wind_direction_deg: enrichment.weather.wind_direction_deg,
      cloud_cover_pct: enrichment.weather.cloud_cover_pct,
      pressure_inhg: enrichment.weather.pressure_inhg,
      pressure_trend: enrichment.weather.pressure_trend,
      precip_last_24h_in: enrichment.weather.precip_24h_in
    };
  }

  // User context
  if (options.platform || options.gearType) {
    contextPack.user_context = {
      platform: options.platform,
      gear_type: options.gearType
    };
  }

  return contextPack;
}

// ============================================================================
// Prompt Builder
// ============================================================================

const RESULT_SCHEMA = `{
  "mode": "general" | "specific",
  "likely_species": [{ "species": "string", "confidence": number (0-1) }],
  "analysis_frame": {
    "type": "photo",
    "width_px": number,
    "height_px": number
  },
  "zones": [{
    "zone_id": "string (e.g., 'A', 'B', 'C')",
    "label": "Primary" | "Secondary" | "Tertiary",
    "confidence": number (0-1),
    "target_species": "string",
    "polygon": [{"x": number (0-1), "y": number (0-1)}, ...],
    "cast_arrow": {
      "start": {"x": number (0-1), "y": number (0-1)},
      "end": {"x": number (0-1), "y": number (0-1)}
    },
    "retrieve_path": [{"x": number (0-1), "y": number (0-1)}, ...],
    "style": {
      "priority": number (1 = highest),
      "hint": "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown"
    }
  }],
  "tactics": [{
    "zone_id": "string (must match a zone)",
    "recommended_rig": "string",
    "alternate_rigs": ["string"],
    "target_depth": "string",
    "retrieve_style": "string",
    "cadence": "string",
    "cast_count_suggestion": "string",
    "why_this_zone_works": ["string"],
    "steps": ["string"]
  }],
  "conditions_summary": ["string"],
  "plan_summary": ["string"],
  "explainability": {
    "scene_observations": ["string"],
    "assumptions": ["string"]
  }
}`;

const ZONE_CONSTRAINTS = `
ZONE REQUIREMENTS:
- Return 1-3 zones maximum, ordered by priority
- Each zone_id must be unique (use "A", "B", "C")
- Labels should be "Primary", "Secondary", "Tertiary" in order
- All polygon points must have exactly {x, y} properties
- All coordinates must be in range [0, 1]
- Coordinates are relative to image: (0,0) = top-left, (1,1) = bottom-right
- Polygon must have at least 3 points
- cast_arrow.start should be from angler's likely position
- cast_arrow.end should point to the target zone area
- Each tactics entry must reference a valid zone_id
`;

function formatContextPack(contextPack: ContextPack): string {
  const sections: string[] = [];

  sections.push(`MODE: ${contextPack.mode}`);
  if (contextPack.target_species) {
    sections.push(`TARGET SPECIES: ${contextPack.target_species}`);
  }

  if (contextPack.user_context) {
    const uc = contextPack.user_context;
    const userParts: string[] = [];
    if (uc.platform) userParts.push(`Platform: ${uc.platform}`);
    if (uc.gear_type) userParts.push(`Gear: ${uc.gear_type}`);
    if (userParts.length > 0) {
      sections.push(`USER CONTEXT:\n${userParts.join('\n')}`);
    }
  }

  if (contextPack.location) {
    const loc = contextPack.location;
    const locParts: string[] = [];
    locParts.push(`Coordinates: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`);
    if (loc.waterbody_name) locParts.push(`Waterbody: ${loc.waterbody_name}`);
    if (loc.water_type && loc.water_type !== 'unknown') {
      locParts.push(`Type: ${loc.water_type}`);
    }
    if (loc.admin_area) locParts.push(`Area: ${loc.admin_area}`);
    if (loc.country) locParts.push(`Country: ${loc.country}`);
    sections.push(`LOCATION:\n${locParts.join('\n')}`);
  }

  if (contextPack.time) {
    const time = contextPack.time;
    sections.push(`TIME:
Local time: ${time.local_time}
Season: ${time.season}
Sunrise: ${time.sunrise_local}, Sunset: ${time.sunset_local}
Daylight phase: ${time.daylight_phase}`);
  }

  if (contextPack.weather) {
    const w = contextPack.weather;
    sections.push(`WEATHER:
Air temp: ${w.air_temp_f}°F
Wind: ${w.wind_speed_mph} mph at ${w.wind_direction_deg}°
Cloud cover: ${w.cloud_cover_pct}%
Precipitation (24h): ${w.precip_last_24h_in} in
Pressure: ${w.pressure_inhg} inHg (${w.pressure_trend})`);
  }

  return sections.join('\n\n');
}

function getModeInstructions(contextPack: ContextPack): string {
  if (contextPack.mode === 'specific' && contextPack.target_species) {
    return `
MODE INSTRUCTIONS (Specific Mode):
- The user is targeting ${contextPack.target_species} specifically
- All tactics should be optimized for ${contextPack.target_species}
- Zone target_species should be "${contextPack.target_species}"
- likely_species array should include ${contextPack.target_species} with high confidence
`;
  }

  return `
MODE INSTRUCTIONS (General Mode):
- Analyze the scene and identify likely species based on water type, structure, and conditions
- Include likely_species array with confidence scores
- Each zone can target the species most likely for that specific area
`;
}

function buildPrompt(contextPack: ContextPack): string {
  const formattedContext = formatContextPack(contextPack);
  const modeInstructions = getModeInstructions(contextPack);

  return `You are CastSense, an expert AI fishing guide that analyzes water scenes to identify optimal cast zones and tactics.

TASK:
Analyze the provided photo and generate overlay-ready fishing recommendations.

${formattedContext}

${modeInstructions}

SAFETY AND COMPLIANCE:
- Include relevant safety notes in conditions_summary
- Do not recommend fishing in unsafe conditions
- Remind users to check local fishing regulations
- Do not make specific claims about fish presence - focus on structure and high-probability zones

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON, no prose or explanation outside the JSON
- Follow the exact schema below
- All coordinates must be normalized [0, 1] relative to image dimensions
- (0, 0) is top-left, (1, 1) is bottom-right

${ZONE_CONSTRAINTS}

OUTPUT SCHEMA:
${RESULT_SCHEMA}

ANALYSIS INSTRUCTIONS:
1. Examine the image for fishing structure: weed lines, rock formations, depth changes, wood/timber, shade lines, current seams, inflows, etc.
2. Identify 1-3 high-probability zones based on visible structure and conditions
3. For each zone, determine the best approach: lure selection, presentation, retrieve style
4. Ensure polygon coordinates accurately outline the identified zone
5. Cast arrows should show realistic casting paths from angler position
6. Provide clear, actionable tactics for each zone

Remember: Return ONLY the JSON object, no additional text.`;
}

// ============================================================================
// AI Client
// ============================================================================

export class AIClientError extends Error {
  constructor(
    message: string,
    public code: 'AI_TIMEOUT' | 'AI_RATE_LIMITED' | 'AI_INVALID_KEY' | 'AI_NETWORK_ERROR' | 'AI_PARSE_ERROR' | 'AI_PROVIDER_ERROR',
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIClientError';
  }
}

/**
 * Analyze image using OpenAI vision API
 * 
 * @param imageBase64 - Base64-encoded image data (without data URL prefix)
 * @param imageWidth - Image width in pixels
 * @param imageHeight - Image height in pixels
 * @param enrichment - Enrichment results (location, weather, solar)
 * @param location - GPS coordinates
 * @param options - Analysis options (mode, target species, etc.)
 * @param apiKey - User's OpenAI API key
 * @returns AI analysis result
 */
export async function analyzeImage(
  imageBase64: string,
  imageWidth: number,
  imageHeight: number,
  enrichment: EnrichmentResults,
  location: { lat: number; lon: number },
  options: AnalysisOptions,
  apiKey: string
): Promise<AIAnalysisResult> {
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey,
      timeout: AI_TIMEOUT_MS_PHOTO,
      maxRetries: 0 // We handle retries at a higher level
    });

    // Build context pack and prompt
    const contextPack = buildContextPack(enrichment, location, options);
    const prompt = buildPrompt(contextPack);

    console.log('[AIClient] Calling OpenAI vision API', {
      model: AI_MODEL,
      promptLength: prompt.length,
      imageSize: { width: imageWidth, height: imageHeight }
    });

    // Build message with image
    const content: ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: prompt
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
          detail: 'high'
        }
      }
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content }],
      max_tokens: 4096,
      temperature: 0.7
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new AIClientError(
        'No content in AI response',
        'AI_PROVIDER_ERROR',
        false
      );
    }

    console.log('[AIClient] Received response from OpenAI', {
      model: completion.model,
      responseLength: responseContent.length
    });

    // Parse JSON response
    let parsed: unknown;
    try {
      // Try to extract JSON if wrapped in prose
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseContent;
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      throw new AIClientError(
        `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        'AI_PARSE_ERROR',
        false
      );
    }

    // Add analysis_frame dimensions
    if (parsed && typeof parsed === 'object') {
      (parsed as any).analysis_frame = {
        type: 'photo',
        width_px: imageWidth,
        height_px: imageHeight
      };
    }

    return {
      result: parsed,
      model: completion.model,
      rawResponse: responseContent
    };

  } catch (error) {
    // Handle OpenAI SDK errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        throw new AIClientError(
          'Invalid API key. Please check your OpenAI API key in settings.',
          'AI_INVALID_KEY',
          false
        );
      }

      if (error.status === 429) {
        throw new AIClientError(
          'OpenAI rate limit reached. Please wait a moment and try again.',
          'AI_RATE_LIMITED',
          true
        );
      }

      if (error.status && error.status >= 500) {
        throw new AIClientError(
          'OpenAI service error. Please try again.',
          'AI_PROVIDER_ERROR',
          true
        );
      }

      throw new AIClientError(
        `OpenAI API error: ${error.message}`,
        'AI_PROVIDER_ERROR',
        error.status ? error.status >= 500 : false
      );
    }

    // Handle timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new AIClientError(
        'AI analysis timed out. Please try again.',
        'AI_TIMEOUT',
        true
      );
    }

    // Re-throw if already AIClientError
    if (error instanceof AIClientError) {
      throw error;
    }

    // Generic network error
    throw new AIClientError(
      `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'AI_NETWORK_ERROR',
      true
    );
  }
}
