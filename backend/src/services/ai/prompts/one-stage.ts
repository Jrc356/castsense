/**
 * One-Stage Prompting (T4.2 - v1 Initial)
 * 
 * Generates a single prompt that produces the final overlay-ready JSON directly.
 * Implements requirements from spec §14.
 */

import { ContextPack } from '../../../types/enrichment';

/**
 * Result schema documentation for the AI
 * Describes the expected output structure per §9 + §17
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
 * Zone schema constraints per §17.1
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
 * Formats context pack as readable text for the AI
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
 * Get mode-specific instructions per §14.2
 */
function getModeInstructions(contextPack: ContextPack): string {
  if (contextPack.mode === 'specific' && contextPack.target_species) {
    return `
MODE INSTRUCTIONS (Specific Mode):
- The user is targeting ${contextPack.target_species} specifically
- All tactics should be optimized for ${contextPack.target_species}
- Zone target_species should be "${contextPack.target_species}"
- likely_species array should include ${contextPack.target_species} with high confidence
- Still identify the best zones, but with this species as the primary target
`;
  }

  return `
MODE INSTRUCTIONS (General Mode):
- Analyze the scene and identify likely species based on water type, structure, and conditions
- Include likely_species array with confidence scores
- Each zone can target the species most likely for that specific area
- Provide varied tactics for different species if multiple are likely
`;
}

/**
 * Video-specific instructions when analyzing multiple frames
 */
function getVideoInstructions(frameCount: number): string {
  return `
VIDEO ANALYSIS:
- You are analyzing ${frameCount} keyframes extracted from a video
- The frames are ordered chronologically
- Examine all frames to understand the full scene
- Choose the BEST frame for overlay rendering (the one showing the most useful fishing structure)
- Set "selected_frame_index" to your chosen frame (0-indexed, 0 to ${frameCount - 1})
- All overlay coordinates should be relative to your selected frame
- Consider how the scene changes across frames when making recommendations
`;
}

/**
 * Safety and disclaimer note per §14.3
 */
const SAFETY_INSTRUCTIONS = `
SAFETY AND COMPLIANCE:
- Include relevant safety notes in conditions_summary (e.g., slippery banks, high wind, storm approaching)
- Do not recommend fishing in unsafe conditions
- If conditions appear hazardous, note this prominently
- Remind users to check local fishing regulations
- Do not make specific claims about fish presence - focus on structure and high-probability zones
`;

/**
 * Builds the one-stage prompt for AI analysis
 * 
 * @param contextPack - Full context pack with enrichment data
 * @param isVideo - Whether this is a video (multiple frames) analysis
 * @param frameCount - Number of frames (only relevant for video)
 * @returns Complete prompt string
 */
export function buildOneStagePrompt(
  contextPack: ContextPack,
  isVideo: boolean,
  frameCount?: number
): string {
  const formattedContext = formatContextPack(contextPack);
  const modeInstructions = getModeInstructions(contextPack);
  const videoInstructions = isVideo && frameCount ? getVideoInstructions(frameCount) : '';

  const prompt = `You are CastSense, an expert AI fishing guide that analyzes water scenes to identify optimal cast zones and tactics.

TASK:
Analyze the provided ${isVideo ? 'video frames' : 'photo'} and generate overlay-ready fishing recommendations.

${formattedContext}

${modeInstructions}
${videoInstructions}
${SAFETY_INSTRUCTIONS}

OUTPUT REQUIREMENTS (§14.1):
- Return ONLY valid JSON, no prose or explanation outside the JSON
- Follow the exact schema below
- All coordinates must be normalized [0, 1] relative to image dimensions
- (0, 0) is top-left, (1, 1) is bottom-right

${ZONE_CONSTRAINTS}

OUTPUT SCHEMA:
${RESULT_SCHEMA}

ANALYSIS INSTRUCTIONS:
1. Carefully examine the image(s) for fishing structure: weed lines, rock formations, depth changes, wood/timber, shade lines, current seams, inflows, etc.
2. Identify 1-3 high-probability zones based on visible structure and conditions
3. For each zone, determine the best approach: lure selection, presentation, retrieve style
4. Ensure polygon coordinates accurately outline the identified zone
5. Cast arrows should show realistic casting paths from angler position
6. Provide clear, actionable tactics for each zone

Remember: Return ONLY the JSON object, no additional text.`;

  return prompt;
}

export default {
  buildOneStagePrompt
};
