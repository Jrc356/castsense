/**
 * Coordinate Mapping Tests (T11.3)
 * 
 * Tests for normalized → screen coordinate mapping
 * with different aspect ratios and fit modes.
 */

import {
  createCoordinateMapper,
  transformPolygonToScreen,
  transformPathToScreen,
  isPointInVisibleArea,
  clampNormalized,
  clampPointToDisplay,
  getPolygonCenter,
  getPolygonBounds,
  type Size,
  type Point
} from '../utils/coordinate-mapping';

describe('Coordinate Mapping Tests (T11.3)', () => {
  describe('createCoordinateMapper', () => {
    test('creates mapper with correct properties', () => {
      const imageSize: Size = { width: 1920, height: 1080 };
      const displaySize: Size = { width: 375, height: 500 };
      
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      expect(mapper.imageSize).toEqual(imageSize);
      expect(mapper.displaySize).toEqual(displaySize);
      expect(mapper.fitMode).toBe('contain');
      expect(typeof mapper.normalizedToScreen).toBe('function');
      expect(typeof mapper.screenToNormalized).toBe('function');
      expect(typeof mapper.getLetterboxOffsets).toBe('function');
      expect(typeof mapper.getScaleFactor).toBe('function');
    });
  });

  describe('Portrait photo in landscape container', () => {
    // Portrait image (3:4 aspect ratio) in landscape container (16:9)
    const imageSize: Size = { width: 1080, height: 1440 };
    const displaySize: Size = { width: 800, height: 450 };
    
    test('contain mode: image is pillarboxed', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      // In contain mode, portrait image in landscape container
      // will be limited by height
      const scale = mapper.getScaleFactor();
      expect(scale).toBe(displaySize.height / imageSize.height);
      
      // Should have pillarbox (horizontal black bars)
      const offsets = mapper.getLetterboxOffsets();
      expect(offsets.x).toBeGreaterThan(0);
      expect(offsets.y).toBe(0);
    });

    test('contain mode: center point maps correctly', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      const center = mapper.normalizedToScreen([0.5, 0.5]);
      
      // Center of display
      expect(center.x).toBe(displaySize.width / 2);
      expect(center.y).toBe(displaySize.height / 2);
    });

    test('contain mode: corners map with offset', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      const offsets = mapper.getLetterboxOffsets();
      
      const topLeft = mapper.normalizedToScreen([0, 0]);
      expect(topLeft.x).toBeCloseTo(offsets.x);
      expect(topLeft.y).toBeCloseTo(0);
      
      const bottomRight = mapper.normalizedToScreen([1, 1]);
      expect(bottomRight.x).toBeCloseTo(displaySize.width - offsets.x);
      expect(bottomRight.y).toBeCloseTo(displaySize.height);
    });

    test('cover mode: image fills container', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'cover');
      
      // In cover mode, image fills the entire container
      const scale = mapper.getScaleFactor();
      expect(scale).toBe(displaySize.width / imageSize.width);
      
      // No positive offsets (image extends beyond container)
      const offsets = mapper.getLetterboxOffsets();
      expect(offsets.x).toBe(0);
      expect(offsets.y).toBe(0);
    });
  });

  describe('Landscape photo in portrait container', () => {
    // Landscape image (16:9) in portrait container (9:16)
    const imageSize: Size = { width: 1920, height: 1080 };
    const displaySize: Size = { width: 375, height: 667 };
    
    test('contain mode: image is letterboxed', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      // Landscape image in portrait container is limited by width
      const scale = mapper.getScaleFactor();
      expect(scale).toBeCloseTo(displaySize.width / imageSize.width);
      
      // Should have letterbox (vertical black bars)
      const offsets = mapper.getLetterboxOffsets();
      expect(offsets.x).toBe(0);
      expect(offsets.y).toBeGreaterThan(0);
    });

    test('contain mode: center point maps correctly', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      const center = mapper.normalizedToScreen([0.5, 0.5]);
      
      expect(center.x).toBeCloseTo(displaySize.width / 2);
      expect(center.y).toBeCloseTo(displaySize.height / 2);
    });

    test('cover mode: image fills container (cropped)', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'cover');
      
      // In cover mode, landscape image fills portrait container
      const scale = mapper.getScaleFactor();
      expect(scale).toBe(displaySize.height / imageSize.height);
      
      const offsets = mapper.getLetterboxOffsets();
      expect(offsets.x).toBe(0);
      expect(offsets.y).toBe(0);
    });

    test('cover mode: corners may be outside visible area', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'cover');
      
      const topLeft = mapper.normalizedToScreen([0, 0]);
      const bottomRight = mapper.normalizedToScreen([1, 1]);
      
      // In cover mode with landscape in portrait, x values will extend beyond
      expect(topLeft.x).toBeLessThan(0);
      expect(bottomRight.x).toBeGreaterThan(displaySize.width);
    });
  });

  describe('Screen to normalized reverse mapping', () => {
    const imageSize: Size = { width: 1920, height: 1080 };
    const displaySize: Size = { width: 375, height: 500 };

    test('round trip: normalized → screen → normalized', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      const original: [number, number] = [0.3, 0.7];
      const screen = mapper.normalizedToScreen(original);
      const roundTrip = mapper.screenToNormalized(screen);
      
      expect(roundTrip[0]).toBeCloseTo(original[0]);
      expect(roundTrip[1]).toBeCloseTo(original[1]);
    });

    test('center screen point maps to center normalized', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      const screenCenter: Point = { 
        x: displaySize.width / 2, 
        y: displaySize.height / 2 
      };
      const normalized = mapper.screenToNormalized(screenCenter);
      
      expect(normalized[0]).toBeCloseTo(0.5);
      expect(normalized[1]).toBeCloseTo(0.5);
    });

    test('reverse mapping works with cover mode', () => {
      const mapper = createCoordinateMapper(imageSize, displaySize, 'cover');
      
      const original: [number, number] = [0.5, 0.5];
      const screen = mapper.normalizedToScreen(original);
      const roundTrip = mapper.screenToNormalized(screen);
      
      expect(roundTrip[0]).toBeCloseTo(original[0]);
      expect(roundTrip[1]).toBeCloseTo(original[1]);
    });
  });

  describe('Letterbox offset calculations', () => {
    test('square image in square container has no offsets', () => {
      const imageSize: Size = { width: 1000, height: 1000 };
      const displaySize: Size = { width: 500, height: 500 };
      
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      const offsets = mapper.getLetterboxOffsets();
      
      expect(offsets.x).toBe(0);
      expect(offsets.y).toBe(0);
    });

    test('contain mode has positive offsets for aspect mismatch', () => {
      const imageSize: Size = { width: 1920, height: 1080 };
      const displaySize: Size = { width: 375, height: 667 };
      
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      const offsets = mapper.getLetterboxOffsets();
      
      // At least one offset should be positive
      expect(offsets.x + offsets.y).toBeGreaterThan(0);
    });

    test('cover mode always returns zero offsets', () => {
      const imageSize: Size = { width: 1920, height: 1080 };
      const displaySize: Size = { width: 375, height: 667 };
      
      const mapper = createCoordinateMapper(imageSize, displaySize, 'cover');
      const offsets = mapper.getLetterboxOffsets();
      
      expect(offsets.x).toBe(0);
      expect(offsets.y).toBe(0);
    });
  });

  describe('transformPolygonToScreen', () => {
    test('transforms polygon coordinates', () => {
      const imageSize: Size = { width: 1920, height: 1080 };
      const displaySize: Size = { width: 375, height: 211 }; // Same aspect ratio
      
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      const normalizedPolygon: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ];
      
      const screenPolygon = transformPolygonToScreen(normalizedPolygon, mapper);
      
      expect(screenPolygon).toHaveLength(4);
      // Use toBeCloseTo for small floating point differences due to aspect ratio rounding
      expect(screenPolygon[0]?.x).toBeCloseTo(0, 0);
      expect(screenPolygon[0]?.y).toBeCloseTo(0, 0);
      expect(screenPolygon[1]?.x).toBeCloseTo(displaySize.width, 0);
      expect(screenPolygon[1]?.y).toBeCloseTo(0, 0);
      expect(screenPolygon[2]?.x).toBeCloseTo(displaySize.width, 0);
      expect(screenPolygon[2]?.y).toBeCloseTo(displaySize.height, 0);
      expect(screenPolygon[3]?.x).toBeCloseTo(0, 0);
      expect(screenPolygon[3]?.y).toBeCloseTo(displaySize.height, 0);
    });
  });

  describe('transformPathToScreen', () => {
    test('transforms path coordinates', () => {
      const imageSize: Size = { width: 1000, height: 1000 };
      const displaySize: Size = { width: 500, height: 500 };
      
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      const path: [number, number][] = [
        [0, 0],
        [0.5, 0.5],
        [1, 1]
      ];
      
      const screenPath = transformPathToScreen(path, mapper);
      
      expect(screenPath).toHaveLength(3);
      expect(screenPath[0]).toEqual({ x: 0, y: 0 });
      expect(screenPath[1]).toEqual({ x: 250, y: 250 });
      expect(screenPath[2]).toEqual({ x: 500, y: 500 });
    });
  });

  describe('isPointInVisibleArea', () => {
    const displaySize: Size = { width: 375, height: 667 };

    test('point inside display returns true', () => {
      expect(isPointInVisibleArea({ x: 100, y: 200 }, displaySize)).toBe(true);
      expect(isPointInVisibleArea({ x: 0, y: 0 }, displaySize)).toBe(true);
      expect(isPointInVisibleArea({ x: 375, y: 667 }, displaySize)).toBe(true);
    });

    test('point outside display returns false', () => {
      expect(isPointInVisibleArea({ x: -10, y: 100 }, displaySize)).toBe(false);
      expect(isPointInVisibleArea({ x: 100, y: -10 }, displaySize)).toBe(false);
      expect(isPointInVisibleArea({ x: 400, y: 100 }, displaySize)).toBe(false);
      expect(isPointInVisibleArea({ x: 100, y: 700 }, displaySize)).toBe(false);
    });
  });

  describe('clampNormalized', () => {
    test('clamps values below 0', () => {
      expect(clampNormalized(-0.5)).toBe(0);
      expect(clampNormalized(-1)).toBe(0);
    });

    test('clamps values above 1', () => {
      expect(clampNormalized(1.5)).toBe(1);
      expect(clampNormalized(2)).toBe(1);
    });

    test('returns values within range unchanged', () => {
      expect(clampNormalized(0)).toBe(0);
      expect(clampNormalized(0.5)).toBe(0.5);
      expect(clampNormalized(1)).toBe(1);
    });
  });

  describe('clampPointToDisplay', () => {
    const displaySize: Size = { width: 375, height: 667 };

    test('clamps point inside display', () => {
      const point: Point = { x: 100, y: 200 };
      const clamped = clampPointToDisplay(point, displaySize);
      expect(clamped).toEqual(point);
    });

    test('clamps negative coordinates', () => {
      const point: Point = { x: -50, y: -100 };
      const clamped = clampPointToDisplay(point, displaySize);
      expect(clamped).toEqual({ x: 0, y: 0 });
    });

    test('clamps coordinates beyond display', () => {
      const point: Point = { x: 500, y: 800 };
      const clamped = clampPointToDisplay(point, displaySize);
      expect(clamped).toEqual({ x: 375, y: 667 });
    });
  });

  describe('getPolygonCenter', () => {
    test('calculates center of square polygon', () => {
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ];
      
      const center = getPolygonCenter(polygon);
      expect(center).toEqual({ x: 50, y: 50 });
    });

    test('calculates center of triangle', () => {
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 90, y: 0 },
        { x: 45, y: 90 }
      ];
      
      const center = getPolygonCenter(polygon);
      expect(center.x).toBeCloseTo(45);
      expect(center.y).toBeCloseTo(30);
    });

    test('returns origin for empty polygon', () => {
      const center = getPolygonCenter([]);
      expect(center).toEqual({ x: 0, y: 0 });
    });
  });

  describe('getPolygonBounds', () => {
    test('calculates bounds of polygon', () => {
      const polygon: Point[] = [
        { x: 10, y: 20 },
        { x: 100, y: 30 },
        { x: 80, y: 150 },
        { x: 5, y: 100 }
      ];
      
      const bounds = getPolygonBounds(polygon);
      expect(bounds.minX).toBe(5);
      expect(bounds.minY).toBe(20);
      expect(bounds.maxX).toBe(100);
      expect(bounds.maxY).toBe(150);
    });

    test('returns zero bounds for empty polygon', () => {
      const bounds = getPolygonBounds([]);
      expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    });
  });

  describe('Real-world scenarios', () => {
    test('iPhone 15 Pro display with 4K landscape photo', () => {
      // iPhone 15 Pro logical dimensions
      const displaySize: Size = { width: 393, height: 852 };
      // 4K landscape photo
      const imageSize: Size = { width: 3840, height: 2160 };
      
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      // Photo should be letterboxed (horizontal bars top/bottom)
      const offsets = mapper.getLetterboxOffsets();
      expect(offsets.x).toBe(0);
      expect(offsets.y).toBeGreaterThan(0);
      
      // Zone in center of photo should map to center of display width
      const zoneCenter = mapper.normalizedToScreen([0.5, 0.5]);
      expect(zoneCenter.x).toBeCloseTo(displaySize.width / 2);
      expect(zoneCenter.y).toBeCloseTo(displaySize.height / 2);
    });

    test('typical fishing zone polygon mapping', () => {
      const displaySize: Size = { width: 375, height: 500 };
      const imageSize: Size = { width: 1920, height: 1080 };
      
      const mapper = createCoordinateMapper(imageSize, displaySize, 'contain');
      
      // Simulate a fishing zone polygon (shore area)
      const normalizedZone: [number, number][] = [
        [0.1, 0.6],
        [0.3, 0.5],
        [0.4, 0.7],
        [0.2, 0.8]
      ];
      
      const screenZone = transformPolygonToScreen(normalizedZone, mapper);
      
      // All points should be valid screen coordinates
      screenZone.forEach(point => {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
      });
      
      // Polygon should maintain shape proportions accounting for image aspect ratio
      const normalizedWidth = Math.max(...normalizedZone.map(p => p[0])) - 
                              Math.min(...normalizedZone.map(p => p[0]));
      const normalizedHeight = Math.max(...normalizedZone.map(p => p[1])) - 
                               Math.min(...normalizedZone.map(p => p[1]));
      
      const screenWidth = Math.max(...screenZone.map(p => p.x)) -
                          Math.min(...screenZone.map(p => p.x));
      const screenHeight = Math.max(...screenZone.map(p => p.y)) -
                           Math.min(...screenZone.map(p => p.y));
      
      // The actual image pixel dimensions of the normalized zone
      const actualImageWidth = normalizedWidth * imageSize.width;
      const actualImageHeight = normalizedHeight * imageSize.height;
      const actualImageRatio = actualImageWidth / actualImageHeight;
      
      const screenRatio = screenWidth / screenHeight;
      
      // Screen ratio should match the actual image ratio (shape is preserved)
      expect(screenRatio).toBeCloseTo(actualImageRatio, 1);
    });
  });
});
