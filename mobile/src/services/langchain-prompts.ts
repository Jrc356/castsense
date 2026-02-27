/**
 * LangChain Prompt Templates (Mobile)
 * 
 * Defines prompt templates for CastSense AI analysis using LangChain.
 * Moved from ai-client.ts as part of LangChain integration.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { EnrichmentResults } from './enrichment';

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

export interface PromptVariables {
  formatted_context: string;
  mode_instructions: string;
}

// ============================================================================
// Context Pack Builder (moved from ai-client.ts)
// ============================================================================

/**
 * Build structured context pack from enrichment results and analysis options.
 * This is the bridge between raw enrichment data and template variables.
 */
export function buildContextPack(
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
// Schema and Constraints (Template Constants)
// ============================================================================

const RESULT_SCHEMA = `{{
  "mode": "general" | "specific",
  "likely_species": [{{ "species": "string", "confidence": number (0-1) }}],
  "analysis_frame": {{
    "type": "photo",
    "width_px": number,
    "height_px": number
  }},
  "zones": [{{
    "zone_id": "string (e.g., 'A', 'B', 'C')",
    "label": "Primary" | "Secondary" | "Tertiary",
    "confidence": number (0-1),
    "target_species": "string",
    "polygon": [{{"x": number (0-1), "y": number (0-1)}}, ...],
    "cast_arrow": {{
      "start": {{"x": number (0-1), "y": number (0-1)}},
      "end": {{"x": number (0-1), "y": number (0-1)}}
    }},
    "retrieve_path": [{{"x": number (0-1), "y": number (0-1)}}, ...],
    "style": {{
      "priority": number (1 = highest),
      "hint": "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown"
    }}
  }}],
  "tactics": [{{
    "zone_id": "string (must match a zone)",
    "recommended_rig": "string",
    "alternate_rigs": ["string"],
    "target_depth": "string",
    "retrieve_style": "string",
    "cadence": "string",
    "cast_count_suggestion": "string",
    "why_this_zone_works": ["string"],
    "steps": ["string"]
  }}],
  "conditions_summary": ["string"],
  "plan_summary": ["string"],
  "explainability": {{
    "scene_observations": ["string"],
    "assumptions": ["string"]
  }}
}}`;

const ZONE_CONSTRAINTS = `
ZONE REQUIREMENTS:
- Return 1-3 zones maximum, ordered by priority
- Each zone_id must be unique (use "A", "B", "C")
- Labels should be "Primary", "Secondary", "Tertiary" in order
- All polygon points must have exactly {{x, y}} properties
- All coordinates must be in range [0, 1]
- Coordinates are relative to image: (0,0) = top-left, (1,1) = bottom-right
- Polygon must have at least 3 points
- cast_arrow.start should be from angler's likely position
- cast_arrow.end should point to the target zone area
- Each tactics entry must reference a valid zone_id
`;

// ============================================================================
// Template Formatters
// ============================================================================

/**
 * Format mode and target species information for the template.
 */
function formatModeSection(contextPack: ContextPack): string {
  const parts: string[] = [`MODE: ${contextPack.mode}`];
  if (contextPack.target_species) {
    parts.push(`TARGET SPECIES: ${contextPack.target_species}`);
  }
  return parts.join('\n\n');
}

/**
 * Format user context (platform, gear type) for the template.
 */
function formatUserContext(contextPack: ContextPack): string {
  if (!contextPack.user_context) {
    return '';
  }

  const uc = contextPack.user_context;
  const userParts: string[] = [];
  if (uc.platform) userParts.push(`Platform: ${uc.platform}`);
  if (uc.gear_type) userParts.push(`Gear: ${uc.gear_type}`);
  
  if (userParts.length === 0) {
    return '';
  }

  return `USER CONTEXT:\n${userParts.join('\n')}`;
}

/**
 * Format location information for the template.
 */
function formatLocation(contextPack: ContextPack): string {
  if (!contextPack.location) {
    return '';
  }

  const loc = contextPack.location;
  const locParts: string[] = [];
  locParts.push(`Coordinates: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`);
  if (loc.waterbody_name) locParts.push(`Waterbody: ${loc.waterbody_name}`);
  if (loc.water_type && loc.water_type !== 'unknown') {
    locParts.push(`Type: ${loc.water_type}`);
  }
  if (loc.admin_area) locParts.push(`Area: ${loc.admin_area}`);
  if (loc.country) locParts.push(`Country: ${loc.country}`);
  
  return `LOCATION:\n${locParts.join('\n')}`;
}

/**
 * Format time and solar information for the template.
 */
function formatTime(contextPack: ContextPack): string {
  if (!contextPack.time) {
    return '';
  }

  const time = contextPack.time;
  return `TIME:
Local time: ${time.local_time}
Season: ${time.season}
Sunrise: ${time.sunrise_local}, Sunset: ${time.sunset_local}
Daylight phase: ${time.daylight_phase}`;
}

/**
 * Format weather information for the template.
 */
function formatWeather(contextPack: ContextPack): string {
  if (!contextPack.weather) {
    return '';
  }

  const w = contextPack.weather;
  return `WEATHER:
Air temp: ${w.air_temp_f}°F
Wind: ${w.wind_speed_mph} mph at ${w.wind_direction_deg}°
Cloud cover: ${w.cloud_cover_pct}%
Precipitation (24h): ${w.precip_last_24h_in} in
Pressure: ${w.pressure_inhg} inHg (${w.pressure_trend})`;
}

/**
 * Format mode-specific instructions for the template.
 */
function formatModeInstructions(contextPack: ContextPack): string {
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

// ============================================================================
// LangChain Prompt Template
// ============================================================================

/**
 * Main CastSense analysis prompt template.
 * Uses LangChain's ChatPromptTemplate for structured prompt building.
 */
const CASTSENSE_PROMPT_TEMPLATE = ChatPromptTemplate.fromMessages([
  [
    'user',
    `You are CastSense, an expert AI fishing guide that analyzes water scenes to identify optimal cast zones and tactics.

TASK:
Analyze the provided photo and generate overlay-ready fishing recommendations.

{formatted_context}

{mode_instructions}

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

Remember: Return ONLY the JSON object, no additional text.`
  ]
]);

// ============================================================================
// Public API
// ============================================================================

/**
 * Build prompt variables from context pack.
 * Converts structured ContextPack into template variables.
 */
export function buildPromptVariables(contextPack: ContextPack): PromptVariables {
  // Build sections array, filtering out empty sections
  const sections: string[] = [];
  
  // Mode section (always present)
  sections.push(formatModeSection(contextPack));
  
  // User context (optional)
  const userContext = formatUserContext(contextPack);
  if (userContext) sections.push(userContext);
  
  // Location (optional)
  const location = formatLocation(contextPack);
  if (location) sections.push(location);
  
  // Time (optional)
  const time = formatTime(contextPack);
  if (time) sections.push(time);
  
  // Weather (optional)
  const weather = formatWeather(contextPack);
  if (weather) sections.push(weather);
  
  // Join all non-empty sections with double newlines
  const formatted_context = sections.join('\n\n');
  
  return {
    formatted_context,
    mode_instructions: formatModeInstructions(contextPack)
  };
}

/**
 * Format the full CastSense analysis prompt using LangChain template.
 * 
 * @param contextPack - Structured context from enrichment + options
 * @returns Formatted prompt text ready for AI model
 */
export async function formatAnalysisPrompt(contextPack: ContextPack): Promise<string> {
  const variables = buildPromptVariables(contextPack);
  const messages = await CASTSENSE_PROMPT_TEMPLATE.formatMessages(variables);
  
  // Extract text from the user message (safe array access)
  const firstMessage = messages[0];
  if (firstMessage?.content) {
    return typeof firstMessage.content === 'string' 
      ? firstMessage.content 
      : JSON.stringify(firstMessage.content);
  }
  
  throw new Error('Failed to format prompt: no message content');
}

/**
 * Get the raw LangChain template for testing or introspection.
 */
export function getPromptTemplate() {
  return CASTSENSE_PROMPT_TEMPLATE;
}
