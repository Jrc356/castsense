/**
 * Text-Only Fallback Builder (T5.5)
 * 
 * Builds a text-only fallback response when validation fails after repair.
 * Returns rendering_mode="text_only" with status="degraded".
 */

import pino from 'pino';
import { ContextPack } from '../../types/enrichment';
import { FallbackResult } from '../../types/validation';

const logger = pino({ name: 'validation-fallback' });

/**
 * Try to extract plan summary from original result
 */
function extractPlanSummary(originalResult: unknown): string[] | null {
  if (!originalResult || typeof originalResult !== 'object') {
    return null;
  }

  const result = originalResult as Record<string, unknown>;

  // Try to get plan_summary
  if (Array.isArray(result.plan_summary) && result.plan_summary.length > 0) {
    // Validate that entries are strings
    const validSummary = result.plan_summary.filter(
      (item): item is string => typeof item === 'string' && item.length > 0
    );
    if (validSummary.length > 0) {
      return validSummary;
    }
  }

  return null;
}

/**
 * Try to extract conditions summary from original result
 */
function extractConditionsSummary(originalResult: unknown): string[] | null {
  if (!originalResult || typeof originalResult !== 'object') {
    return null;
  }

  const result = originalResult as Record<string, unknown>;

  if (Array.isArray(result.conditions_summary) && result.conditions_summary.length > 0) {
    const validConditions = result.conditions_summary.filter(
      (item): item is string => typeof item === 'string' && item.length > 0
    );
    if (validConditions.length > 0) {
      return validConditions;
    }
  }

  return null;
}

/**
 * Try to extract tactics text from original result
 */
function extractTacticsText(originalResult: unknown): {
  recommended_rig: string;
  target_depth: string;
  retrieve_style: string;
  why_this_zone_works: string[];
} | null {
  if (!originalResult || typeof originalResult !== 'object') {
    return null;
  }

  const result = originalResult as Record<string, unknown>;

  // Try to get the first tactic with valid data
  if (Array.isArray(result.tactics) && result.tactics.length > 0) {
    for (const tactic of result.tactics) {
      if (tactic && typeof tactic === 'object') {
        const t = tactic as Record<string, unknown>;
        
        if (
          typeof t.recommended_rig === 'string' &&
          typeof t.target_depth === 'string' &&
          typeof t.retrieve_style === 'string' &&
          Array.isArray(t.why_this_zone_works) &&
          t.why_this_zone_works.length > 0
        ) {
          return {
            recommended_rig: t.recommended_rig,
            target_depth: t.target_depth,
            retrieve_style: t.retrieve_style,
            why_this_zone_works: t.why_this_zone_works.filter(
              (s): s is string => typeof s === 'string'
            )
          };
        }
      }
    }
  }

  return null;
}

/**
 * Generate generic plan summary based on context
 */
function generateGenericPlanSummary(contextPack: ContextPack): string[] {
  const summary: string[] = [];

  const targetSpecies = contextPack.target_species || 'fish';
  const waterType = contextPack.location.water_type || 'waterbody';
  const waterbodyName = contextPack.location.waterbody_name;

  // Location context
  if (waterbodyName) {
    summary.push(`Analyze structure and cover in ${waterbodyName} for ${targetSpecies}.`);
  } else {
    summary.push(`Look for structure and cover that might hold ${targetSpecies}.`);
  }

  // Time context
  const daylightPhase = contextPack.time.daylight_phase;
  switch (daylightPhase) {
    case 'pre_dawn':
    case 'sunrise':
      summary.push('Early morning is prime feeding time - focus on shallow areas and transition zones.');
      break;
    case 'golden_hour':
    case 'sunset':
      summary.push('Evening feeding window - fish may be more active in shallower water.');
      break;
    case 'day':
      summary.push('During midday, target shaded areas and deeper structure.');
      break;
    case 'night':
    case 'after_sunset':
      summary.push('Low light conditions - slow presentations near structure may be effective.');
      break;
  }

  // Weather context
  if (contextPack.weather) {
    if (contextPack.weather.wind_speed_mph > 10) {
      summary.push('Windy conditions can concentrate baitfish along windblown banks.');
    }
    if (contextPack.weather.cloud_cover_pct > 70) {
      summary.push('Overcast conditions often allow fish to roam more freely.');
    }
  }

  return summary;
}

/**
 * Generate generic tactics based on context
 */
function generateGenericTactics(contextPack: ContextPack): {
  recommended_rig: string;
  target_depth: string;
  retrieve_style: string;
  why_this_zone_works: string[];
} {
  const gearType = contextPack.user_context.gear_type || 'spinning';
  const platform = contextPack.user_context.platform || 'shore';
  const targetSpecies = contextPack.target_species || 'bass';

  // Generic recommendations based on context
  let recommended_rig = 'Medium-diving crankbait or soft plastic';
  let target_depth = '3-8 feet';
  let retrieve_style = 'Steady retrieve with occasional pauses';

  // Adjust based on gear type
  if (gearType === 'fly') {
    recommended_rig = 'Woolly bugger or streamer pattern';
    retrieve_style = 'Strip retrieve with varied cadence';
  } else if (gearType === 'baitcasting') {
    recommended_rig = 'Spinnerbait or jig with trailer';
  }

  // Adjust based on time of day
  const phase = contextPack.time.daylight_phase;
  if (phase === 'pre_dawn' || phase === 'sunrise' || phase === 'sunset' || phase === 'golden_hour') {
    recommended_rig = 'Topwater or shallow-running presentation';
    target_depth = 'Surface to 4 feet';
  } else if (phase === 'day') {
    target_depth = '6-12 feet';
    retrieve_style = 'Slow presentation near bottom structure';
  }

  const why_this_zone_works = [
    'Analysis encountered an issue - providing general guidance based on conditions.',
    `${targetSpecies} often relate to structure and cover in varying conditions.`,
    'Focus on transition areas between shallow and deep water.'
  ];

  return {
    recommended_rig,
    target_depth,
    retrieve_style,
    why_this_zone_works
  };
}

/**
 * Build a text-only fallback response
 * 
 * Used when validation fails even after repair attempt.
 * Extracts what it can from the original result, fills in generic content otherwise.
 * 
 * @param originalResult - The original (invalid) result, used to extract any valid text
 * @param contextPack - Context pack for generating fallback content
 * @returns FallbackResult with text-only content
 */
export function buildTextOnlyFallback(
  originalResult: unknown,
  contextPack: ContextPack
): FallbackResult {
  logger.info('Building text-only fallback response');

  // Try to extract valid content from original result
  const extractedPlanSummary = extractPlanSummary(originalResult);
  const extractedConditions = extractConditionsSummary(originalResult);
  const extractedTactics = extractTacticsText(originalResult);

  // Build fallback result
  const planSummary = extractedPlanSummary || generateGenericPlanSummary(contextPack);
  const tactics = extractedTactics || generateGenericTactics(contextPack);

  const result: FallbackResult['result'] = {
    mode: contextPack.mode,
    zones: [], // Empty zones for text-only
    tactics: [
      {
        zone_id: 'N/A',
        recommended_rig: tactics.recommended_rig,
        target_depth: tactics.target_depth,
        retrieve_style: tactics.retrieve_style,
        why_this_zone_works: tactics.why_this_zone_works
      }
    ],
    plan_summary: planSummary
  };

  // Add conditions if available
  if (extractedConditions) {
    result.conditions_summary = extractedConditions;
  }

  logger.info({
    extractedPlanSummary: !!extractedPlanSummary,
    extractedConditions: !!extractedConditions,
    extractedTactics: !!extractedTactics
  }, 'Fallback response built');

  return {
    result,
    renderingMode: 'text_only',
    status: 'degraded'
  };
}

export default {
  buildTextOnlyFallback
};
