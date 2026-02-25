/**
 * Polygon Hit Test Tests (T11.3)
 * 
 * Tests for point-in-polygon detection for zone selection.
 */

import {
  isPointInPolygon,
  distanceToPolygon,
  findZoneAtPoint,
  findAllZonesAtPoint,
  findNearestZone,
  hitTestWithExpansion
} from '../utils/polygon-hit-test';
import { createCoordinateMapper, type Point } from '../utils/coordinate-mapping';
import type { Zone } from '../types/contracts';

// Helper to create a simple Zone for testing
function createTestZone(
  zoneId: string,
  polygon: [number, number][],
  priority?: number
): Zone {
  return {
    zone_id: zoneId,
    label: `Zone ${zoneId}`,
    confidence: 0.9,
    target_species: 'Bass',
    polygon: polygon as [[number, number], [number, number], [number, number], ...[number, number][]],
    cast_arrow: {
      start: [0.5, 0.8] as [number, number],
      end: [0.2, 0.3] as [number, number]
    },
    style: priority !== undefined ? { priority } : undefined
  };
}

describe('Polygon Hit Test Tests (T11.3)', () => {
  describe('isPointInPolygon', () => {
    describe('convex polygons', () => {
      // Simple square polygon
      const square: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ];

      test('point clearly inside polygon returns true', () => {
        expect(isPointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
        expect(isPointInPolygon({ x: 25, y: 75 }, square)).toBe(true);
        expect(isPointInPolygon({ x: 1, y: 1 }, square)).toBe(true);
        expect(isPointInPolygon({ x: 99, y: 99 }, square)).toBe(true);
      });

      test('point clearly outside polygon returns false', () => {
        expect(isPointInPolygon({ x: -50, y: 50 }, square)).toBe(false);
        expect(isPointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
        expect(isPointInPolygon({ x: 50, y: -50 }, square)).toBe(false);
        expect(isPointInPolygon({ x: 50, y: 150 }, square)).toBe(false);
        expect(isPointInPolygon({ x: -10, y: -10 }, square)).toBe(false);
      });

      test('point on edge behavior', () => {
        // Note: Points exactly on edges may return true or false depending
        // on the ray casting implementation. We test for consistent behavior.
        const onTopEdge = isPointInPolygon({ x: 50, y: 0 }, square);
        const onBottomEdge = isPointInPolygon({ x: 50, y: 100 }, square);
        const onLeftEdge = isPointInPolygon({ x: 0, y: 50 }, square);
        const onRightEdge = isPointInPolygon({ x: 100, y: 50 }, square);
        
        // Just verify these don't throw errors
        expect(typeof onTopEdge).toBe('boolean');
        expect(typeof onBottomEdge).toBe('boolean');
        expect(typeof onLeftEdge).toBe('boolean');
        expect(typeof onRightEdge).toBe('boolean');
      });

      test('point on vertex behavior', () => {
        const onCorner = isPointInPolygon({ x: 0, y: 0 }, square);
        expect(typeof onCorner).toBe('boolean');
      });
    });

    describe('concave polygons', () => {
      // L-shaped concave polygon
      const lShape: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 100 },
        { x: 0, y: 100 }
      ];

      test('point inside concave region returns true', () => {
        expect(isPointInPolygon({ x: 25, y: 25 }, lShape)).toBe(true);
        expect(isPointInPolygon({ x: 75, y: 25 }, lShape)).toBe(true);
        expect(isPointInPolygon({ x: 25, y: 75 }, lShape)).toBe(true);
      });

      test('point in concave cutout returns false', () => {
        // The concave "notch" area
        expect(isPointInPolygon({ x: 75, y: 75 }, lShape)).toBe(false);
        expect(isPointInPolygon({ x: 60, y: 60 }, lShape)).toBe(false);
      });

      test('point outside concave polygon returns false', () => {
        expect(isPointInPolygon({ x: -10, y: 50 }, lShape)).toBe(false);
        expect(isPointInPolygon({ x: 110, y: 25 }, lShape)).toBe(false);
      });
    });

    describe('triangles', () => {
      const triangle: Point[] = [
        { x: 50, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ];

      test('point inside triangle', () => {
        expect(isPointInPolygon({ x: 50, y: 50 }, triangle)).toBe(true);
        expect(isPointInPolygon({ x: 50, y: 80 }, triangle)).toBe(true);
      });

      test('point outside triangle', () => {
        expect(isPointInPolygon({ x: 10, y: 10 }, triangle)).toBe(false);
        expect(isPointInPolygon({ x: 90, y: 10 }, triangle)).toBe(false);
      });
    });

    describe('edge cases', () => {
      test('polygon with less than 3 points returns false', () => {
        const point: Point[] = [{ x: 0, y: 0 }];
        const line: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
        
        expect(isPointInPolygon({ x: 0, y: 0 }, point)).toBe(false);
        expect(isPointInPolygon({ x: 50, y: 50 }, line)).toBe(false);
      });

      test('empty polygon returns false', () => {
        expect(isPointInPolygon({ x: 0, y: 0 }, [])).toBe(false);
      });
    });
  });

  describe('distanceToPolygon', () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ];

    test('point on edge has zero distance', () => {
      expect(distanceToPolygon({ x: 50, y: 0 }, square)).toBeCloseTo(0);
      expect(distanceToPolygon({ x: 100, y: 50 }, square)).toBeCloseTo(0);
    });

    test('point away from polygon has positive distance', () => {
      expect(distanceToPolygon({ x: 50, y: -10 }, square)).toBeCloseTo(10);
      expect(distanceToPolygon({ x: 110, y: 50 }, square)).toBeCloseTo(10);
    });

    test('point inside polygon has distance to nearest edge', () => {
      // Point at center, 50 units from all edges
      expect(distanceToPolygon({ x: 50, y: 50 }, square)).toBeCloseTo(50);
      // Point close to left edge
      expect(distanceToPolygon({ x: 5, y: 50 }, square)).toBeCloseTo(5);
    });

    test('returns Infinity for degenerate polygon', () => {
      expect(distanceToPolygon({ x: 0, y: 0 }, [])).toBe(Infinity);
      expect(distanceToPolygon({ x: 0, y: 0 }, [{ x: 0, y: 0 }])).toBe(Infinity);
    });
  });

  describe('findZoneAtPoint', () => {
    const displaySize = { width: 375, height: 667 };
    const imageSize = { width: 375, height: 667 }; // 1:1 for simple math
    const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');

    test('returns zone when point is inside', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]])
      ];

      // Point inside zone (in screen coordinates)
      const result = findZoneAtPoint(
        { x: 100, y: 100 }, // Within the zone
        zones,
        mapper
      );

      expect(result).not.toBeNull();
      expect(result!.zone_id).toBe('Z1');
    });

    test('returns null when point is outside all zones', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]])
      ];

      // Point far outside zone
      const result = findZoneAtPoint(
        { x: 350, y: 600 },
        zones,
        mapper
      );

      expect(result).toBeNull();
    });

    test('returns highest priority zone when overlapping', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]], 2),
        createTestZone('Z2', [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]], 1) // Higher priority (lower number)
      ];

      // Point in overlapping area (x=100, y=200 is inside both zones)
      const result = findZoneAtPoint(
        { x: 100, y: 200 },
        zones,
        mapper
      );

      expect(result).not.toBeNull();
      expect(result!.zone_id).toBe('Z2'); // Higher priority
    });

    test('returns null for empty zones array', () => {
      expect(findZoneAtPoint({ x: 100, y: 100 }, [], mapper)).toBeNull();
    });

    test('handles null zones array', () => {
      expect(findZoneAtPoint({ x: 100, y: 100 }, null as unknown as Zone[], mapper)).toBeNull();
    });
  });

  describe('findAllZonesAtPoint', () => {
    const displaySize = { width: 375, height: 667 };
    const imageSize = { width: 375, height: 667 };
    const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');

    test('returns all overlapping zones', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]], 2),
        createTestZone('Z2', [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]], 1),
        createTestZone('Z3', [[0.7, 0.7], [0.9, 0.7], [0.9, 0.9], [0.7, 0.9]], 3)
      ];

      // Point in overlapping area of Z1 and Z2 (x=100, y=200 is inside both)
      const result = findAllZonesAtPoint(
        { x: 100, y: 200 },
        zones,
        mapper
      );

      expect(result.length).toBe(2);
      expect(result.map(z => z.zone_id)).toContain('Z1');
      expect(result.map(z => z.zone_id)).toContain('Z2');
    });

    test('returns zones sorted by priority', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]], 3),
        createTestZone('Z2', [[0.15, 0.15], [0.45, 0.15], [0.45, 0.45], [0.15, 0.45]], 1),
        createTestZone('Z3', [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]], 2)
      ];

      // Point inside all three zones (x=100, y=200)
      const result = findAllZonesAtPoint(
        { x: 100, y: 200 },
        zones,
        mapper
      );

      // Should be sorted by priority (1, 2, 3)
      expect(result[0]?.zone_id).toBe('Z2'); // priority 1
      expect(result[1]?.zone_id).toBe('Z3'); // priority 2
      expect(result[2]?.zone_id).toBe('Z1'); // priority 3
    });

    test('returns empty array when no zones match', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]])
      ];

      const result = findAllZonesAtPoint(
        { x: 350, y: 600 },
        zones,
        mapper
      );

      expect(result).toEqual([]);
    });
  });

  describe('findNearestZone', () => {
    const displaySize = { width: 375, height: 667 };
    const imageSize = { width: 375, height: 667 };
    const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');

    test('returns zone when point is inside', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3], [0.1, 0.3]])
      ];

      const result = findNearestZone(
        { x: 75, y: 75 },
        zones,
        mapper
      );

      expect(result).not.toBeNull();
      expect(result!.zone_id).toBe('Z1');
    });

    test('returns nearest zone within max distance', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]])
      ];

      // Point just outside zone
      const result = findNearestZone(
        { x: 90, y: 50 }, // Slightly outside the zone
        zones,
        mapper,
        50 // Max distance
      );

      expect(result).not.toBeNull();
      expect(result!.zone_id).toBe('Z1');
    });

    test('returns null when no zone within max distance', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]])
      ];

      // Point far from zone
      const result = findNearestZone(
        { x: 350, y: 600 },
        zones,
        mapper,
        30
      );

      expect(result).toBeNull();
    });
  });

  describe('hitTestWithExpansion', () => {
    const displaySize = { width: 375, height: 667 };
    const imageSize = { width: 375, height: 667 };
    const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');

    test('returns zone on exact hit', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3], [0.1, 0.3]])
      ];

      const result = hitTestWithExpansion(
        { x: 75, y: 75 },
        zones,
        mapper
      );

      expect(result).not.toBeNull();
      expect(result!.zone_id).toBe('Z1');
    });

    test('returns zone on near miss within expansion', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]])
      ];

      // Point just outside zone but within default expansion
      const result = hitTestWithExpansion(
        { x: 85, y: 50 },
        zones,
        mapper,
        20
      );

      expect(result).not.toBeNull();
      expect(result!.zone_id).toBe('Z1');
    });

    test('returns null when outside expansion', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]])
      ];

      const result = hitTestWithExpansion(
        { x: 350, y: 600 },
        zones,
        mapper,
        20
      );

      expect(result).toBeNull();
    });
  });

  describe('Multiple overlapping zones', () => {
    const displaySize = { width: 400, height: 400 };
    const imageSize = { width: 400, height: 400 };
    const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');

    test('handles three overlapping zones', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0, 0], [0.6, 0], [0.6, 0.6], [0, 0.6]], 3),
        createTestZone('Z2', [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]], 2),
        createTestZone('Z3', [[0.4, 0.4], [0.9, 0.4], [0.9, 0.9], [0.4, 0.9]], 1)
      ];

      // Point in center where all three overlap
      const center = { x: 200, y: 200 };

      const single = findZoneAtPoint(center, zones, mapper);
      expect(single).not.toBeNull();
      expect(single!.zone_id).toBe('Z3'); // Highest priority (lowest number)

      const all = findAllZonesAtPoint(center, zones, mapper);
      expect(all.length).toBe(3);
      expect(all[0]?.zone_id).toBe('Z3');
      expect(all[1]?.zone_id).toBe('Z2');
      expect(all[2]?.zone_id).toBe('Z1');
    });

    test('handles zones with no priority (default)', () => {
      const zones: Zone[] = [
        createTestZone('Z1', [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]]),
        createTestZone('Z2', [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]])
      ];

      // Both zones don't have explicit priority
      const all = findAllZonesAtPoint({ x: 120, y: 120 }, zones, mapper);
      expect(all.length).toBe(2);
    });
  });
});
