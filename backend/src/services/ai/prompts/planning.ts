/**
 * Planning Stage Prompt (T4.3 - Stage 2)
 * 
 * Stage 2 "Planning" prompt that uses perception observations + context pack
 * to generate the final overlay-ready JSON with zones and tactics.
 */

import { ContextPack } from '../../../types/enrichment';
import { PerceptionResult } from '../../../types/ai';

/**
 * Result schema documentation for the AI (same as one-stage)
 */
const RESULT_SCHEMA = `{
  "mode": "general" | "specific",
  "likely_species": [
    { "species": "string", "confidence": number (0-1) }
  ],
  "analysis_frame": {
    "type": "photo" | "video_frame",
    "width_px": number,
    "height_px": number,
    "selected_frame_index": number (required for video),
    "frame_timestamp_ms": number (optional, for video)
  },
  "zones": [
    {
      "zone_id": "string (1-8 chars, e.g., 'A', 'B', 'C')",
      "label": "Primary" | "Secondary" | "Tertiary",
      "confidence": number (0-1),
      "target_species": "string",
      "polygon": [[x,y], [x,y], [x,y], ...] (minimum 3 points, all coordinates 0-1),
      "cast_arrow": {
        "start": [x, y] (angler position, coordinates 0-1),
        "end": [x, y] (target in zone, coordinates 0-1)
      },
      "retrieve_path": [[x,y], [x,y], ...] (optional, coordinates 0-1),
      "style": {
        "priority": number (1 = highest),
        "hint": "cover" | "structure" | "current" | "depth_edge" | "shade" | "inflow" | "unknown"
      }
    }
  ],
  "tactics": [
    {
      "zone_id": "string (must match a zone)",
      "recommended_rig": "string",
      "alternate_rigs": ["string"],
      "target_depth": "string",
      "retrieve_style": "string",
      "cadence": "string",
      "cast_count_suggestion": "string",
      "why_this_zone_works": ["string"],
      "steps": ["string"]
    }
  ],
  "conditions_summary": ["string"],
  "plan_summary": ["string"],
  "explainability": {
    "scene_observations": ["string"],
    "assumptions": ["string"]
  }
}`;

/**
 * Zone constraints (same as one-stage)
 */
const ZONE_CONSTRAINTS = `
ZONE REQUIREMENTS:
- Return 1-3 zones maximum, ordered by priority
- Each zone_id must be unique (use "A", "B", "C")
- Labels should be "Primary", "Secondary", "Tertiary" in order
- All polygon points must be arrays of exactly [x, y]
- All coordinates (polygon, cast_arrow, retrieve_path) must be in range [0, 1]
- Coordinates are relative to image: (0,0) = top-left, (1,1) = bottom-right
- Polygon must have at least 3 points to form a closed shape
- cast_arrow.start should be from angler's likely position (often bottom of image)
- cast_arrow.end should point to the target zone area
- Each tactics entry must reference a valid zone_id from zones array
`;

/**
 * Formats context pack for the planning prompt
 */
function formatContextPack(contextPack: ContextPack): string {
  const sections: string[] = [];

  // Mode and target
  sections.push(`MODE: ${contextPack.mode}`);
  if (contextPack.target_species) {
    sections.push(`TARGET SPECIES: ${contextPack.target_species}`);
  }

  // User context
  if (contextPack.user_context) {
    const uc = contextPack.user_context;
    const userParts: string[] = [];
    if (uc.platform) userParts.push(`Platform: ${uc.platform}`);
    if (uc.gear_type) userParts.push(`Gear: ${uc.gear_type}`);
    if (uc.constraints?.lures_available?.length) {
      userParts.push(`Available lures: ${uc.constraints.lures_available.join(', ')}`);
    }
    if (uc.constraints?.line_test_lb) {
      userParts.push(`Line test: ${uc.constraints.line_test_lb}lb`);
    }
    if (uc.constraints?.notes) {
      userParts.push(`Notes: ${uc.constraints.notes}`);
    }
    if (userParts.length > 0) {
      sections.push(`USER CONTEXT:\n${userParts.join('\n')}`);
    }
  }

  // Location
  if (contextPack.location) {
    const loc = contextPack.location;
    const locParts: string[] = [];
    locParts.push(`Coordinates: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`);
    if (loc.waterbody_name) locParts.push(`Waterbody: ${loc.waterbody_name}`);
    if (loc.water_type !== 'unknown') locParts.push(`Type: ${loc.water_type}`);
    if (loc.admin_area) locParts.push(`Area: ${loc.admin_area}`);
    if (loc.country) locParts.push(`Country: ${loc.country}`);
    sections.push(`LOCATION:\n${locParts.join('\n')}`);
  }

  // Time
  if (contextPack.time) {
    const time = contextPack.time;
    sections.push(`TIME:
Local time: ${time.local_time}
Season: ${time.season}
Sunrise: ${time.sunrise_local}, Sunset: ${time.sunset_local}
Daylight phase: ${time.daylight_phase}`);
  }

  // Weather
  if (contextPack.weather) {
    const w = contextPack.weather;
    sections.push(`WEATHER:
Air temp: ${w.air_temp_f}°F
Wind: ${w.wind_speed_mph} mph at ${w.wind_direction_deg}°
Cloud cover: ${w.cloud_cover_pct}%
Precipitation (24h): ${w.precip_last_24h_in} in
Pressure: ${w.pressure_inhg} inHg (${w.pressure_trend})`);
  }

  // Hydrology
  if (contextPack.hydrology) {
    const h = contextPack.hydrology;
    sections.push(`HYDROLOGY:
Flow: ${h.flow_cfs} cfs
Gauge height: ${h.gauge_height_ft} ft`);
  }

  return sections.join('\n\n');
}

/**
 * Formats perception result for the planning prompt
 */
function formatPerceptionResult(perception: PerceptionResult): string {
  const sections: string[] = [];

  // Scene observations
  if (perception.scene_observations.length > 0) {
    sections.push(`SCENE OBSERVATIONS:\n${perception.scene_observations.map(o => `• ${o}`).join('\n')}`);
  }

  // Structure elements
  if (perception.structure_elements.length > 0) {
    const elements = perception.structure_elements
      .sort((a, b) => b.confidence - a.confidence)
      .map(e => `• ${e.type} at ${e.location_hint} (confidence: ${(e.confidence * 100).toFixed(0)}%)`);
    sections.push(`IDENTIFIED STRUCTURE:\n${elements.join('\n')}`);
  }

  // Water conditions
  sections.push(`WATER CONDITIONS:
Clarity: ${perception.water_conditions.clarity}
Current: ${perception.water_conditions.current}`);

  // Constraints
  if (perception.constraints.length > 0) {
    sections.push(`CONSTRAINTS/HAZARDS:\n${perception.constraints.map(c => `• ${c}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Get mode-specific instructions
 */
function getModeInstructions(contextPack: ContextPack): string {
  if (contextPack.mode === 'specific' && contextPack.target_species) {
    return `
MODE INSTRUCTIONS (Specific Mode):
- The user is targeting ${contextPack.target_species} specifically
- All tactics should be optimized for ${contextPack.target_species}
- Zone target_species should be "${contextPack.target_species}"
- likely_species array should include ${contextPack.target_species} with high confidence
- Focus zones on structure/conditions optimal for this species
`;
  }

  return `
MODE INSTRUCTIONS (General Mode):
- Identify likely species based on water type, structure, and conditions
- Include likely_species array with confidence scores
- Each zone can target the species most likely for that specific area
- Provide varied tactics for different species if multiple are likely
`;
}

/**
 * Video-specific planning instructions
 */
function getVideoPlanningInstructions(frameCount: number): string {
  return `
VIDEO PLANNING:
- You analyzed ${frameCount} keyframes from a video
- Choose the BEST frame for overlay rendering
- Set "selected_frame_index" to your chosen frame (0-indexed, 0 to ${frameCount - 1})
- All overlay coordinates should be relative to your selected frame
- Use structure visibility to guide frame selection
`;
}

/**
 * Safety instructions
 */
const SAFETY_INSTRUCTIONS = `
SAFETY AND COMPLIANCE:
- Include relevant safety notes in conditions_summary
- Note any visible hazards (slippery banks, strong current, etc.)
- If conditions appear hazardous, warn the user
- Remind users to check local fishing regulations
- Do not guarantee fish presence - focus on high-probability zones
`;

/**
 * Builds the planning (Stage 2) prompt
 * 
 * This prompt uses:
 * - Perception observations (Stage 1 output)
 * - Full context pack (weather, location, time, etc.)
 * - Mode and target species info
 * 
 * To generate the final overlay-ready JSON.
 * 
 * @param perception - Results from Stage 1 perception
 * @param contextPack - Full context pack with enrichment data
 * @param isVideo - Whether analyzing video frames
 * @param frameCount - Number of frames (for video)
 * @returns Planning prompt string
 */
export function buildPlanningPrompt(
  perception: PerceptionResult,
  contextPack: ContextPack,
  isVideo: boolean,
  frameCount?: number
): string {
  const formattedContext = formatContextPack(contextPack);
  const formattedPerception = formatPerceptionResult(perception);
  const modeInstructions = getModeInstructions(contextPack);
  const videoInstructions = isVideo && frameCount ? getVideoPlanningInstructions(frameCount) : '';

  const prompt = `You are CastSense, an expert AI fishing guide. You have been provided with visual observations from a scene analysis and environmental context. Your task is to generate overlay-ready fishing recommendations.

VISUAL OBSERVATIONS (from scene analysis):
${formattedPerception}

ENVIRONMENTAL CONTEXT:
${formattedContext}

${modeInstructions}
${videoInstructions}
${SAFETY_INSTRUCTIONS}

YOUR TASK:
Using the visual observations and environmental context above:
1. Identify 1-3 high-probability cast zones based on the observed structure
2. Rank zones by priority based on conditions and structure quality
3. Generate precise polygon coordinates for each zone
4. Recommend specific tactics for each zone considering weather, time, and gear
5. Provide cast arrows showing realistic casting paths

${ZONE_CONSTRAINTS}

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON matching the schema below
- No prose or explanation outside the JSON
- All coordinates must be normalized [0, 1]
- Ensure zones correspond to the identified structure elements
- Tactics must be actionable and specific

OUTPUT SCHEMA:
${RESULT_SCHEMA}

PLANNING GUIDELINES:
- Match zones to the most promising structure elements from observations
- Consider time of day and weather when recommending depths and presentations
- Use the user's available gear/lures when possible
- Account for any constraints or hazards noted in observations
- Prioritize structure combinations (e.g., shade + depth change)

Return ONLY the JSON object.`;

  return prompt;
}

export default {
  buildPlanningPrompt
};
