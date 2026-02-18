/**
 * Referential Integrity Validation (T5.3)
 * 
 * Validates referential integrity between zones and tactics:
 * - Every tactics[].zone_id must exist in zones[].zone_id
 * - Every zone should have at least one corresponding tactic
 */

import pino from 'pino';
import { ValidationResult, ValidationError } from '../../types/validation';

const logger = pino({ name: 'integrity-validator' });

/**
 * Validate referential integrity between zones and tactics
 * 
 * @param result - Parsed AI result object
 * @returns ValidationResult with valid flag and any errors
 */
export function validateReferentialIntegrity(result: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!result || typeof result !== 'object') {
    return {
      valid: false,
      errors: [{
        type: 'integrity',
        path: '(root)',
        message: 'Result must be an object',
        value: result
      }]
    };
  }

  const resultObj = result as Record<string, unknown>;
  const zones = resultObj.zones;
  const tactics = resultObj.tactics;

  // Build set of valid zone IDs
  const zoneIds = new Set<string>();
  const zoneIdToIndex = new Map<string, number>();
  
  if (Array.isArray(zones)) {
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i] as Record<string, unknown>;
      if (zone && typeof zone.zone_id === 'string') {
        if (zoneIds.has(zone.zone_id)) {
          errors.push({
            type: 'integrity',
            path: `zones[${i}].zone_id`,
            message: `Duplicate zone_id: "${zone.zone_id}"`,
            value: zone.zone_id
          });
        } else {
          zoneIds.add(zone.zone_id);
          zoneIdToIndex.set(zone.zone_id, i);
        }
      }
    }
  }

  // Track which zones have tactics
  const zonesWithTactics = new Set<string>();

  // Validate tactics reference valid zones
  if (Array.isArray(tactics)) {
    for (let i = 0; i < tactics.length; i++) {
      const tactic = tactics[i] as Record<string, unknown>;
      if (!tactic || typeof tactic !== 'object') {
        errors.push({
          type: 'integrity',
          path: `tactics[${i}]`,
          message: 'Tactic must be an object',
          value: tactic
        });
        continue;
      }

      const zoneId = tactic.zone_id;
      
      if (typeof zoneId !== 'string') {
        errors.push({
          type: 'integrity',
          path: `tactics[${i}].zone_id`,
          message: 'zone_id must be a string',
          value: zoneId
        });
        continue;
      }

      // Special case: "N/A" is allowed for text-only fallback
      if (zoneId === 'N/A') {
        // N/A is valid for text-only mode, no zone reference needed
        continue;
      }

      // Check that zone_id exists in zones array
      if (!zoneIds.has(zoneId)) {
        errors.push({
          type: 'integrity',
          path: `tactics[${i}].zone_id`,
          message: `zone_id "${zoneId}" does not match any zone in zones array`,
          value: zoneId
        });
      } else {
        zonesWithTactics.add(zoneId);
      }
    }
  }

  // Check that all zones have corresponding tactics
  // Only check if we have at least one zone (skip for text-only results)
  if (Array.isArray(zones) && zones.length > 0 && Array.isArray(tactics) && tactics.length > 0) {
    for (const zoneId of zoneIds) {
      if (!zonesWithTactics.has(zoneId)) {
        const zoneIndex = zoneIdToIndex.get(zoneId);
        errors.push({
          type: 'integrity',
          path: `zones[${zoneIndex}]`,
          message: `Zone "${zoneId}" has no corresponding tactic in tactics array`,
          value: zoneId
        });
      }
    }
  }

  // Special validation: if zones is empty, tactics should have N/A zone_ids
  if (Array.isArray(zones) && zones.length === 0 && Array.isArray(tactics)) {
    for (let i = 0; i < tactics.length; i++) {
      const tactic = tactics[i] as Record<string, unknown>;
      if (tactic && tactic.zone_id && tactic.zone_id !== 'N/A') {
        errors.push({
          type: 'integrity',
          path: `tactics[${i}].zone_id`,
          message: `When zones is empty, tactics zone_id should be "N/A", got "${tactic.zone_id}"`,
          value: tactic.zone_id
        });
      }
    }
  }

  const valid = errors.length === 0;

  if (!valid) {
    logger.info({
      errorCount: errors.length,
      zoneCount: zoneIds.size,
      tacticsCount: Array.isArray(tactics) ? tactics.length : 0,
      errors: errors.slice(0, 5)
    }, 'Referential integrity validation failed');
  } else {
    logger.debug({
      zoneCount: zoneIds.size,
      tacticsCount: Array.isArray(tactics) ? tactics.length : 0
    }, 'Referential integrity validation passed');
  }

  return {
    valid,
    errors
  };
}

export default {
  validateReferentialIntegrity
};
