/**
 * Geometry and Bounds Validation (T5.2)
 * 
 * Validates numeric bounds and geometry constraints:
 * - All coordinates must be in [0,1] normalized range
 * - Polygons must have >= 3 points
 * - Zones count must be within configured limits
 * - Confidence values must be in [0,1]
 */

import pino from 'pino';
import { ValidationResult, ValidationError, ValidationConfig } from '../../types/validation';

const logger = pino({ name: 'geometry-validator' });

/**
 * Get validation configuration from environment
 */
export function getValidationConfig(): ValidationConfig {
  return {
    maxZones: parseInt(process.env.MAX_ZONES || '', 10) || 3,
    minZones: 1,
    strictMode: process.env.VALIDATION_STRICT_MODE === 'true'
  };
}

/**
 * Check if a value is a valid normalized coordinate [0, 1]
 */
function isValidCoordinate(value: unknown): value is number {
  return typeof value === 'number' && 
         !isNaN(value) && 
         isFinite(value) && 
         value >= 0 && 
         value <= 1;
}

/**
 * Check if a value is a valid confidence score [0, 1]
 */
function isValidConfidence(value: unknown): value is number {
  return isValidCoordinate(value); // Same range
}

/**
 * Check if a point is a valid [x, y] coordinate pair
 */
function isValidPoint(point: unknown): point is [number, number] {
  return Array.isArray(point) &&
         point.length === 2 &&
         isValidCoordinate(point[0]) &&
         isValidCoordinate(point[1]);
}

/**
 * Validate a single polygon
 */
function validatePolygon(
  polygon: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (!Array.isArray(polygon)) {
    errors.push({
      type: 'geometry',
      path,
      message: 'Polygon must be an array',
      value: polygon
    });
    return;
  }

  // Check minimum points (triangle = 3 points)
  if (polygon.length < 3) {
    errors.push({
      type: 'geometry',
      path,
      message: `Polygon must have at least 3 points, got ${polygon.length}`,
      value: polygon.length
    });
  }

  // Validate each point
  for (let i = 0; i < polygon.length; i++) {
    const point = polygon[i];
    const pointPath = `${path}[${i}]`;

    if (!Array.isArray(point)) {
      errors.push({
        type: 'geometry',
        path: pointPath,
        message: 'Point must be an array [x, y]',
        value: point
      });
      continue;
    }

    if (point.length !== 2) {
      errors.push({
        type: 'geometry',
        path: pointPath,
        message: `Point must have exactly 2 coordinates, got ${point.length}`,
        value: point
      });
      continue;
    }

    // Check x coordinate
    if (!isValidCoordinate(point[0])) {
      errors.push({
        type: 'bounds',
        path: `${pointPath}[0]`,
        message: `X coordinate must be a number in [0, 1], got ${point[0]}`,
        value: point[0]
      });
    }

    // Check y coordinate
    if (!isValidCoordinate(point[1])) {
      errors.push({
        type: 'bounds',
        path: `${pointPath}[1]`,
        message: `Y coordinate must be a number in [0, 1], got ${point[1]}`,
        value: point[1]
      });
    }
  }
}

/**
 * Validate a cast arrow (start and end points)
 */
function validateCastArrow(
  arrow: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (!arrow || typeof arrow !== 'object') {
    errors.push({
      type: 'geometry',
      path,
      message: 'Cast arrow must be an object with start and end points',
      value: arrow
    });
    return;
  }

  const arrowObj = arrow as Record<string, unknown>;

  // Validate start point
  if ('start' in arrowObj) {
    const start = arrowObj.start;
    if (!isValidPoint(start)) {
      errors.push({
        type: 'bounds',
        path: `${path}.start`,
        message: 'Start point must be [x, y] with coordinates in [0, 1]',
        value: start
      });
    }
  }

  // Validate end point
  if ('end' in arrowObj) {
    const end = arrowObj.end;
    if (!isValidPoint(end)) {
      errors.push({
        type: 'bounds',
        path: `${path}.end`,
        message: 'End point must be [x, y] with coordinates in [0, 1]',
        value: end
      });
    }
  }
}

/**
 * Validate a retrieve path (array of points)
 */
function validateRetrievePath(
  path_value: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (!Array.isArray(path_value)) {
    return; // Optional field, let schema validation handle missing/wrong type
  }

  for (let i = 0; i < path_value.length; i++) {
    const point = path_value[i];
    const pointPath = `${path}[${i}]`;

    if (!isValidPoint(point)) {
      errors.push({
        type: 'bounds',
        path: pointPath,
        message: 'Retrieve path point must be [x, y] with coordinates in [0, 1]',
        value: point
      });
    }
  }
}

/**
 * Validate confidence values in the result
 */
function validateConfidenceValues(
  result: Record<string, unknown>,
  errors: ValidationError[]
): void {
  // Check likely_species confidence
  const likelySpecies = result.likely_species;
  if (Array.isArray(likelySpecies)) {
    for (let i = 0; i < likelySpecies.length; i++) {
      const species = likelySpecies[i] as Record<string, unknown>;
      if (species && 'confidence' in species) {
        if (!isValidConfidence(species.confidence)) {
          errors.push({
            type: 'bounds',
            path: `likely_species[${i}].confidence`,
            message: `Confidence must be a number in [0, 1], got ${species.confidence}`,
            value: species.confidence
          });
        }
      }
    }
  }

  // Check zone confidence values
  const zones = result.zones;
  if (Array.isArray(zones)) {
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i] as Record<string, unknown>;
      if (zone && 'confidence' in zone) {
        if (!isValidConfidence(zone.confidence)) {
          errors.push({
            type: 'bounds',
            path: `zones[${i}].confidence`,
            message: `Confidence must be a number in [0, 1], got ${zone.confidence}`,
            value: zone.confidence
          });
        }
      }
    }
  }
}

/**
 * Validate geometry and bounds constraints on an AI result
 * 
 * @param result - Parsed AI result object
 * @returns ValidationResult with valid flag and any errors
 */
export function validateGeometry(result: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const config = getValidationConfig();

  if (!result || typeof result !== 'object') {
    return {
      valid: false,
      errors: [{
        type: 'geometry',
        path: '(root)',
        message: 'Result must be an object',
        value: result
      }]
    };
  }

  const resultObj = result as Record<string, unknown>;

  // Validate zones array
  const zones = resultObj.zones;
  if (Array.isArray(zones)) {
    // Check zone count constraints
    if (zones.length > config.maxZones) {
      errors.push({
        type: 'geometry',
        path: 'zones',
        message: `Too many zones: got ${zones.length}, maximum is ${config.maxZones}`,
        value: zones.length
      });
    }

    // Note: Empty zones array is valid for text-only fallback

    // Validate each zone
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i] as Record<string, unknown>;
      if (!zone || typeof zone !== 'object') {
        errors.push({
          type: 'geometry',
          path: `zones[${i}]`,
          message: 'Zone must be an object',
          value: zone
        });
        continue;
      }

      // Validate polygon
      if ('polygon' in zone) {
        validatePolygon(zone.polygon, `zones[${i}].polygon`, errors);
      }

      // Validate cast arrow
      if ('cast_arrow' in zone) {
        validateCastArrow(zone.cast_arrow, `zones[${i}].cast_arrow`, errors);
      }

      // Validate retrieve path (optional)
      if ('retrieve_path' in zone) {
        validateRetrievePath(zone.retrieve_path, `zones[${i}].retrieve_path`, errors);
      }
    }
  }

  // Validate confidence values
  validateConfidenceValues(resultObj, errors);

  const valid = errors.length === 0;

  if (!valid) {
    logger.info({
      errorCount: errors.length,
      errors: errors.slice(0, 5)
    }, 'Geometry validation failed');
  } else {
    logger.debug('Geometry validation passed');
  }

  return {
    valid,
    errors
  };
}

export default {
  validateGeometry,
  getValidationConfig
};
