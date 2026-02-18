/**
 * CastSense Polygon Hit Testing
 *
 * Point-in-polygon algorithm using ray casting for zone selection.
 */

import type { Point, CoordinateMapper } from './coordinate-mapping';
import { transformPolygonToScreen } from './coordinate-mapping';
import type { Zone } from '../types/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Ray Casting Algorithm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a point is inside a polygon using the ray casting algorithm.
 *
 * The algorithm casts a ray from the point to the right (+x direction)
 * and counts how many polygon edges it crosses. If odd, the point is inside.
 *
 * @param point - The point to test
 * @param polygon - Array of points defining the polygon vertices
 * @returns true if the point is inside the polygon
 *
 * @example
 * const polygon = [
 *   { x: 0, y: 0 },
 *   { x: 100, y: 0 },
 *   { x: 100, y: 100 },
 *   { x: 0, y: 100 }
 * ];
 * isPointInPolygon({ x: 50, y: 50 }, polygon); // true
 * isPointInPolygon({ x: 150, y: 50 }, polygon); // false
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  const { x, y } = point;
  let inside = false;

  // Ray casting algorithm
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    // Check if edge crosses the ray
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate distance from a point to a polygon edge (for near-miss detection).
 */
export function distanceToPolygon(point: Point, polygon: Point[]): number {
  if (polygon.length < 2) {
    return Infinity;
  }

  let minDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const distance = distanceToSegment(point, polygon[i], polygon[j]);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Calculate distance from a point to a line segment.
 */
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Segment is a point
    return Math.sqrt(
      (point.x - a.x) * (point.x - a.x) + (point.y - a.y) * (point.y - a.y)
    );
  }

  // Project point onto the line
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.sqrt(
    (point.x - projX) * (point.x - projX) +
      (point.y - projY) * (point.y - projY)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone Hit Testing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the zone at a given screen point.
 *
 * Zones are tested in priority order (lower priority number = higher priority).
 * If multiple zones contain the point, the highest priority one is returned.
 *
 * @param point - Screen coordinates to test
 * @param zones - Array of zones from the analysis result
 * @param mapper - Coordinate mapper for transforming polygon coordinates
 * @returns The zone at the point, or null if no zone contains the point
 *
 * @example
 * const zone = findZoneAtPoint(
 *   { x: 150, y: 200 },
 *   analysisResult.zones,
 *   coordinateMapper
 * );
 * if (zone) {
 *   console.log(`Tapped zone: ${zone.label}`);
 * }
 */
export function findZoneAtPoint(
  point: Point,
  zones: Zone[],
  mapper: CoordinateMapper
): Zone | null {
  if (!zones || zones.length === 0) {
    return null;
  }

  // Sort zones by priority (lower number = higher priority)
  const sortedZones = [...zones].sort((a, b) => {
    const priorityA = a.style?.priority ?? 999;
    const priorityB = b.style?.priority ?? 999;
    return priorityA - priorityB;
  });

  // Test each zone in priority order
  for (const zone of sortedZones) {
    const screenPolygon = transformPolygonToScreen(zone.polygon, mapper);
    if (isPointInPolygon(point, screenPolygon)) {
      return zone;
    }
  }

  return null;
}

/**
 * Find all zones that contain a given screen point.
 *
 * Useful when zones overlap and you want to show all options.
 *
 * @param point - Screen coordinates to test
 * @param zones - Array of zones from the analysis result
 * @param mapper - Coordinate mapper for transforming polygon coordinates
 * @returns Array of zones containing the point, sorted by priority
 */
export function findAllZonesAtPoint(
  point: Point,
  zones: Zone[],
  mapper: CoordinateMapper
): Zone[] {
  if (!zones || zones.length === 0) {
    return [];
  }

  const matchingZones: Zone[] = [];

  for (const zone of zones) {
    const screenPolygon = transformPolygonToScreen(zone.polygon, mapper);
    if (isPointInPolygon(point, screenPolygon)) {
      matchingZones.push(zone);
    }
  }

  // Sort by priority
  return matchingZones.sort((a, b) => {
    const priorityA = a.style?.priority ?? 999;
    const priorityB = b.style?.priority ?? 999;
    return priorityA - priorityB;
  });
}

/**
 * Find the nearest zone to a point (for near-miss selection).
 *
 * @param point - Screen coordinates
 * @param zones - Array of zones
 * @param mapper - Coordinate mapper
 * @param maxDistance - Maximum distance to consider (in screen pixels)
 * @returns The nearest zone within maxDistance, or null
 */
export function findNearestZone(
  point: Point,
  zones: Zone[],
  mapper: CoordinateMapper,
  maxDistance: number = 30
): Zone | null {
  if (!zones || zones.length === 0) {
    return null;
  }

  let nearestZone: Zone | null = null;
  let nearestDistance = Infinity;

  for (const zone of zones) {
    const screenPolygon = transformPolygonToScreen(zone.polygon, mapper);

    // First check if point is inside
    if (isPointInPolygon(point, screenPolygon)) {
      // Point is inside, this is the best match
      return zone;
    }

    // Calculate distance to polygon edge
    const distance = distanceToPolygon(point, screenPolygon);
    if (distance < nearestDistance && distance <= maxDistance) {
      nearestDistance = distance;
      nearestZone = zone;
    }
  }

  return nearestZone;
}

/**
 * Create a touch-friendly hit test with expanded touch targets.
 *
 * This is useful for small zones that may be hard to tap precisely.
 *
 * @param point - Touch point
 * @param zones - Zones to test
 * @param mapper - Coordinate mapper
 * @param expansion - Pixels to expand hit targets by
 * @returns Zone at point, or nearest within expansion distance
 */
export function hitTestWithExpansion(
  point: Point,
  zones: Zone[],
  mapper: CoordinateMapper,
  expansion: number = 20
): Zone | null {
  // First try exact hit
  const exactHit = findZoneAtPoint(point, zones, mapper);
  if (exactHit) {
    return exactHit;
  }

  // If no exact hit, find nearest within expansion
  return findNearestZone(point, zones, mapper, expansion);
}
