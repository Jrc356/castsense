/**
 * Perception Stage Prompt (T4.3 - Stage 1)
 * 
 * Stage 1 "Perception" prompt that returns structured observations about the scene.
 * This stage focuses on visual analysis without fishing strategy.
 */

import { PerceptionResult } from '../../../types/ai';

/**
 * Schema for perception output
 */
const PERCEPTION_SCHEMA = `{
  "scene_observations": [
    "string describing what is visible in the scene"
  ],
  "structure_elements": [
    {
      "type": "weed_line" | "rock_pile" | "submerged_timber" | "fallen_tree" | 
             "dock" | "bridge_piling" | "drop_off" | "point" | "cove" | 
             "inlet" | "outlet" | "riprap" | "vegetation_edge" | "lily_pads" |
             "depth_change" | "current_seam" | "eddy" | "shade_line" | "other",
      "location_hint": "description of where in image (e.g., 'center-left', 'upper-right quadrant')",
      "confidence": number (0-1)
    }
  ],
  "water_conditions": {
    "clarity": "clear" | "slightly_stained" | "stained" | "murky" | "unknown",
    "current": "still" | "slow" | "moderate" | "fast" | "unknown"
  },
  "constraints": [
    "string describing any obstacles, hazards, or limitations visible"
  ]
}`;

/**
 * Video-specific perception instructions
 */
function getVideoPerceptionInstructions(frameCount: number): string {
  return `
VIDEO FRAME ANALYSIS:
- You are analyzing ${frameCount} sequential keyframes from a video
- Examine each frame carefully to build a complete picture
- Note any changes between frames (camera movement, angle changes)
- Identify structure visible across multiple frames
- Note which frame(s) show the best view of each structure element
`;
}

/**
 * Builds the perception (Stage 1) prompt
 * 
 * This prompt focuses purely on visual analysis:
 * - What structures are visible?
 * - What are the water conditions?
 * - What constraints or hazards exist?
 * 
 * It does NOT include fishing strategy - that comes in Stage 2 (Planning).
 * 
 * @param isVideo - Whether analyzing video frames
 * @param frameCount - Number of frames (for video)
 * @returns Perception prompt string
 */
export function buildPerceptionPrompt(
  isVideo: boolean,
  frameCount?: number
): string {
  const videoInstructions = isVideo && frameCount 
    ? getVideoPerceptionInstructions(frameCount) 
    : '';

  const prompt = `You are an expert scene analyst specializing in freshwater and saltwater environments. Your task is to carefully observe and document what you see in the provided ${isVideo ? 'video frames' : 'image'}.

TASK: Analyze the visual content and return structured observations.

DO NOT:
- Make fishing recommendations
- Suggest lures or tactics
- Provide strategy advice
- Make assumptions about fish presence

DO:
- Describe exactly what you observe
- Identify all visible structure and features
- Assess water conditions based on visual cues
- Note any hazards or constraints
- Be specific about locations within the image
${videoInstructions}

OBSERVATION GUIDELINES:

STRUCTURE ELEMENTS TO IDENTIFY:
- Vegetation: weed lines, lily pads, submerged grass, algae mats
- Wood: fallen trees, submerged timber, stumps, docks
- Rock: visible rocks, riprap, boulder fields, rock piles
- Man-made: docks, bridge pilings, retaining walls, boat lifts
- Depth features: drop-offs, points, ledges, channels
- Current features: seams, eddies, inflows, outflows
- Light/shade: shade lines, overhanging trees

WATER CLARITY ASSESSMENT:
- Clear: can see bottom in shallow areas, high visibility
- Slightly stained: light tint, moderate visibility
- Stained: notable color, reduced visibility
- Murky: poor visibility, heavy sediment/algae

CURRENT ASSESSMENT:
- Still: no visible movement
- Slow: subtle surface movement or drift
- Moderate: clear directional flow
- Fast: rapid water movement, possible white water

LOCATION HINTS:
Use descriptive locations like:
- "top-left corner", "center-right", "lower third"
- "foreground", "mid-ground", "background"
- "along the left shoreline", "near the center of frame"

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON matching the schema
- No prose or explanation outside JSON
- Be thorough but factual
- Only report what is actually visible
- Use "unknown" when conditions cannot be determined

SCHEMA:
${PERCEPTION_SCHEMA}`;

  return prompt;
}

/**
 * Parses and validates perception result
 * 
 * @param rawJson - Raw JSON string from AI
 * @returns Parsed perception result
 * @throws Error if parsing fails or validation fails
 */
export function parsePerceptionResult(rawJson: string): PerceptionResult {
  const parsed = JSON.parse(rawJson);

  // Basic validation
  if (!Array.isArray(parsed.scene_observations)) {
    throw new Error('Invalid perception result: scene_observations must be an array');
  }
  if (!Array.isArray(parsed.structure_elements)) {
    throw new Error('Invalid perception result: structure_elements must be an array');
  }
  if (!parsed.water_conditions || typeof parsed.water_conditions !== 'object') {
    throw new Error('Invalid perception result: water_conditions must be an object');
  }
  if (!Array.isArray(parsed.constraints)) {
    throw new Error('Invalid perception result: constraints must be an array');
  }

  // Validate structure elements
  for (const element of parsed.structure_elements) {
    if (typeof element.type !== 'string') {
      throw new Error('Invalid structure element: type must be a string');
    }
    if (typeof element.location_hint !== 'string') {
      throw new Error('Invalid structure element: location_hint must be a string');
    }
    if (typeof element.confidence !== 'number' || element.confidence < 0 || element.confidence > 1) {
      throw new Error('Invalid structure element: confidence must be a number between 0 and 1');
    }
  }

  // Validate water conditions
  if (typeof parsed.water_conditions.clarity !== 'string') {
    throw new Error('Invalid water_conditions: clarity must be a string');
  }
  if (typeof parsed.water_conditions.current !== 'string') {
    throw new Error('Invalid water_conditions: current must be a string');
  }

  return parsed as PerceptionResult;
}

export default {
  buildPerceptionPrompt,
  parsePerceptionResult
};
