/**
 * LangChain Prompt Templates
 * 
 * Defines prompt templates for CastSense AI analysis using LangChain.
 * Moved from ai-client.ts as part of LangChain integration.
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, type BaseMessage } from '@langchain/core/messages';
import type { EnrichmentResults } from './enrichment';

// ============================================================================
// Version
// ============================================================================

/**
 * Semantic version of the prompt template.
 * 
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes to prompt structure or output format
 * - MINOR: Backward-compatible additions (new sections, variables, instructions)
 * - PATCH: Bug fixes, wording improvements, clarifications
 * 
 * Current version: 1.1.0
 * - XML-tagged prompt sections for improved model parsing
 * - Structured output contract block for reliable JSON-only output
 * - Gear-specific instructions section (fly / spinning / baitcasting)
 * - Coordinate sanity check in zone requirements
 * - Few-shot example anchoring output format
 */
export const PROMPT_VERSION = '1.1.0' as const;

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
  location: { lat: number; lon: number } | undefined,
  options: AnalysisOptions
): ContextPack {
  const contextPack: ContextPack = {
    mode: options.mode,
    target_species: options.targetSpecies || null
  };

  // Location
  if (enrichment.reverseGeocode && location) {
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
    "polygon": [[number (0-1), number (0-1)], ...],
    "cast_arrow": {{
      "start": [number (0-1), number (0-1)],
      "end": [number (0-1), number (0-1)]
    }},
    "retrieve_path": [[number (0-1), number (0-1)], ...],
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

const ZONE_CONSTRAINTS = `- Return 1-3 zones maximum, ordered by priority
- Each zone_id must be unique (use "A", "B", "C")
- Labels must be "Primary", "Secondary", "Tertiary" in order
- All polygon points must be [x, y] arrays (NOT objects)
- All coordinates must be within range [0, 1] — verify every coordinate before output
- Coordinates are relative to image: (0,0) = top-left, (1,1) = bottom-right
- Polygon must have at least 3 non-collinear points
- cast_arrow, retrieve_path, and all polygon coordinates must also be within [0, 1]
- cast_arrow.start should be from the angler's likely position
- cast_arrow.end should point to the target zone area
- Each tactics entry must reference a valid zone_id`;

// Minimal example anchoring the exact output format (few-shot)
const PROMPT_EXAMPLE = `{{
  "mode": "general",
  "likely_species": [{{"species": "largemouth bass", "confidence": 0.82}}],
  "analysis_frame": {{"type": "photo", "width_px": 1280, "height_px": 720}},
  "zones": [{{
    "zone_id": "A",
    "label": "Primary",
    "confidence": 0.88,
    "target_species": "largemouth bass",
    "polygon": [[0.25, 0.35], [0.55, 0.35], [0.55, 0.65], [0.25, 0.65]],
    "cast_arrow": {{"start": [0.5, 0.95], "end": [0.4, 0.5]}},
    "retrieve_path": [[0.4, 0.5], [0.45, 0.7], [0.5, 0.95]],
    "style": {{"priority": 1, "hint": "structure"}}
  }}],
  "tactics": [{{
    "zone_id": "A",
    "recommended_rig": "Texas rig 4in worm",
    "alternate_rigs": ["drop shot", "shaky head jig"],
    "target_depth": "4-6 ft",
    "retrieve_style": "slow drag with pauses",
    "cadence": "drag 2 ft, pause 3 s, repeat",
    "cast_count_suggestion": "3-5 casts from multiple angles",
    "why_this_zone_works": ["submerged structure provides cover", "depth transition concentrates fish"],
    "steps": ["Cast to the far edge of structure", "Allow bait to sink to bottom", "Drag slowly with rod tip low"]
  }}],
  "conditions_summary": ["Overcast skies reduce light penetration and encourage bolder feeding", "Always check local fishing regulations"],
  "plan_summary": ["Focus on the submerged structure in Zone A with a weedless bottom presentation"],
  "explainability": {{
    "scene_observations": ["Submerged rock pile visible near center-right", "Color change indicates depth transition"],
    "assumptions": ["Water depth estimated at 4-6 ft based on water clarity"]
  }}
}}`;

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
 * Format gear-type-specific instructions for the template.
 * Returns an XML-tagged block that steers terminology and presentation style,
 * or an empty string when no actionable gear type is set.
 */
function formatGearInstructions(contextPack: ContextPack): string {
  const gearType = contextPack.user_context?.gear_type;

  if (!gearType || gearType === 'unknown') {
    return '';
  }

  let instructions: string;

  switch (gearType) {
    case 'fly':
      instructions = `The angler is using FLY FISHING gear. Follow these rules strictly:
- Recommend only fly fishing presentations: dry fly, nymph, wet fly, streamer, or indicator rigs
- Frame retrieve_style in fly fishing terms: drift, swing, mend, strip, dead drift, across-and-down
- Suggest fly-appropriate cast approaches: upstream dead drift, across-and-swing, downstream swing
- Do NOT recommend spinning or baitcasting lures (crankbait, jig, spinner, swimbait, soft plastic, drop-shot, etc.)
- recommended_rig and alternate_rigs must use fly fishing terminology only`;
      break;
    case 'spinning':
      instructions = `The angler is using SPINNING gear. Follow these rules strictly:
- Recommend spinning-appropriate presentations: jigs, soft plastics, spinners, crankbaits, swimbaits, drop-shot
- Frame retrieve_style in spinning terms: steady retrieve, stop-and-go, twitch-and-pause, deadstick
- Do NOT recommend fly fishing presentations (dry fly, nymph, streamer, indicator, etc.)
- recommended_rig should reflect spinning tackle (lure choice, hook size, weight)`;
      break;
    case 'baitcasting':
      instructions = `The angler is using BAITCASTING gear. Follow these rules strictly:
- Recommend baitcasting-appropriate presentations: heavy lures, flipping/pitching rigs, punch baits, swimbaits, chatterbaits
- Frame retrieve_style to emphasize power fishing: flipping, pitching, power retrieve, burn-and-kill
- Emphasize structure-heavy fishing: heavy cover, laydowns, docks, deep ledges
- recommended_rig should reflect heavier tackle appropriate for baitcasting`;
      break;
    default:
      return '';
  }

  return `<gear_instructions>\n${instructions}\n</gear_instructions>`;
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
    `You are CastSense, an expert AI fishing guide. You analyze water scene photos to identify optimal cast zones and provide precise, gear-appropriate fishing tactics.

<task>
Analyze the provided photo and generate overlay-ready fishing recommendations as a single valid JSON object.
</task>

<context>
{formatted_context}
</context>

<mode_instructions>
{mode_instructions}
</mode_instructions>

<safety_and_compliance>
- Include relevant safety notes in conditions_summary
- Do not recommend fishing in unsafe conditions
- Remind users to check local fishing regulations
- Do not make specific claims about fish presence — focus on structure and high-probability zones
</safety_and_compliance>

<structured_output_contract>
- Output ONLY the JSON object — no prose, no markdown fences, no explanation outside the JSON
- Follow the exact schema in <output_schema> below
- Do not invent fields not defined in the schema
- Validate that all brackets and braces are balanced before finishing
- If a required value cannot be determined, use a sensible default from the schema
</structured_output_contract>

<zone_requirements>
${ZONE_CONSTRAINTS}
</zone_requirements>

<output_schema>
${RESULT_SCHEMA}
</output_schema>

<example>
${PROMPT_EXAMPLE}
</example>

<analysis_instructions>
1. Examine the image for fishing structure: weed lines, rock formations, depth changes, wood/timber, shade lines, current seams, inflows, etc.
2. Identify 1-3 high-probability zones based on visible structure and conditions
3. For each zone, determine the best approach: lure selection, presentation, and retrieve style — matched to the angler's gear type if specified in <gear_instructions> inside <context>
4. Ensure polygon coordinates accurately outline the identified zone and pass all sanity checks in <zone_requirements>
5. Cast arrows should show realistic casting paths from the angler's likely position
6. Provide clear, actionable tactics for each zone
</analysis_instructions>`
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

  // Gear-specific instructions (optional — after user context, before environmental data)
  const gearInstructions = formatGearInstructions(contextPack);
  if (gearInstructions) sections.push(gearInstructions);

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
 * Format conversation history for inclusion in prompt.
 * 
 * Converts BaseMessage[] to human-readable format for context.
 * Truncates AI responses to avoid excessive token usage.
 * 
 * @param history - Array of HumanMessage and AIMessage
 * @returns Formatted conversation history string
 */
export function formatConversationHistory(history: BaseMessage[]): string {
  if (!history || history.length === 0) {
    return '';
  }

  const formattedMessages = history.map((msg) => {
    const role = msg instanceof HumanMessage ? 'USER' : 'AI';
    let content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    
    // Truncate AI responses to first 500 chars to save tokens
    if (role === 'AI' && content.length > 500) {
      content = content.substring(0, 500) + '... [truncated]';
    }
    
    return `${role}: ${content}`;
  }).join('\n\n');

  return `\n\nPREVIOUS CONVERSATION:\n${formattedMessages}\n`;
}

/**
 * Format the full CastSense analysis prompt using LangChain template.
 * 
 * @param contextPack - Structured context from enrichment + options
 * @param conversationHistory - Optional conversation history for follow-up queries
 * @returns Formatted prompt text ready for AI model
 */
export async function formatAnalysisPrompt(
  contextPack: ContextPack,
  conversationHistory?: BaseMessage[]
): Promise<string> {
  const variables = buildPromptVariables(contextPack);
  const messages = await CASTSENSE_PROMPT_TEMPLATE.formatMessages(variables);
  
  // Extract text from the user message (safe array access)
  const firstMessage = messages[0];
  if (!firstMessage?.content) {
    throw new Error('Failed to format prompt: no message content');
  }
  
  let promptText = typeof firstMessage.content === 'string' 
    ? firstMessage.content 
    : JSON.stringify(firstMessage.content);
  
  // Append conversation history if provided
  if (conversationHistory && conversationHistory.length > 0) {
    promptText += formatConversationHistory(conversationHistory);
  }
  
  return promptText;
}

/**
 * Get the raw LangChain template for testing or introspection.
 */
export function getPromptTemplate() {
  return CASTSENSE_PROMPT_TEMPLATE;
}
