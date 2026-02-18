/**
 * CastSense Coordinate Mapping Utility
 *
 * Maps normalized [0..1] result coordinates to screen coordinates
 * accounting for aspect ratio differences and letterboxing.
 *
 * Supports both "contain" (letterboxed) and "cover" (cropped) fit modes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface CoordinateMapper {
  /** Convert normalized [0..1] coordinates to screen coordinates */
  normalizedToScreen(point: [number, number]): Point;
  /** Convert screen coordinates to normalized [0..1] coordinates */
  screenToNormalized(point: Point): [number, number];
  /** Get letterbox/pillarbox offsets (0 for cover mode) */
  getLetterboxOffsets(): { x: number; y: number };
  /** Get the scale factor used for mapping */
  getScaleFactor(): number;
  /** Original image size */
  imageSize: Size;
  /** Display container size */
  displaySize: Size;
  /** Fit mode used */
  fitMode: 'contain' | 'cover';
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate scale and offset for fitting an image to a display area.
 */
function calculateFit(
  imageSize: Size,
  displaySize: Size,
  fitMode: 'contain' | 'cover'
): { scale: number; offsetX: number; offsetY: number } {
  const imageAspect = imageSize.width / imageSize.height;
  const displayAspect = displaySize.width / displaySize.height;

  let scale: number;

  if (fitMode === 'contain') {
    // Contain: scale to fit entirely within display, may have letterbox/pillarbox
    scale =
      imageAspect > displayAspect
        ? displaySize.width / imageSize.width // Wider image: limited by width
        : displaySize.height / imageSize.height; // Taller image: limited by height
  } else {
    // Cover: scale to fill entire display, may crop
    scale =
      imageAspect > displayAspect
        ? displaySize.height / imageSize.height // Wider image: scale to fill height
        : displaySize.width / imageSize.width; // Taller image: scale to fill width
  }

  const scaledWidth = imageSize.width * scale;
  const scaledHeight = imageSize.height * scale;

  // Center the image
  const offsetX = (displaySize.width - scaledWidth) / 2;
  const offsetY = (displaySize.height - scaledHeight) / 2;

  return { scale, offsetX, offsetY };
}

/**
 * Create a coordinate mapper for transforming between normalized
 * and screen coordinate systems.
 *
 * @param imageSize - Original image dimensions in pixels
 * @param displaySize - Display container dimensions in pixels
 * @param fitMode - How the image is fit: 'contain' (letterbox) or 'cover' (crop)
 * @returns CoordinateMapper instance
 *
 * @example
 * const mapper = createCoordinateMapper(
 *   { width: 1920, height: 1080 },
 *   { width: 375, height: 500 },
 *   'contain'
 * );
 *
 * // Convert normalized point to screen
 * const screenPoint = mapper.normalizedToScreen([0.5, 0.5]);
 *
 * // Convert screen point to normalized
 * const normalized = mapper.screenToNormalized({ x: 187, y: 250 });
 */
export function createCoordinateMapper(
  imageSize: Size,
  displaySize: Size,
  fitMode: 'contain' | 'cover'
): CoordinateMapper {
  const { scale, offsetX, offsetY } = calculateFit(
    imageSize,
    displaySize,
    fitMode
  );

  // For normalized coordinates, we need to scale from 0..1 to the scaled image size
  const scaledImageWidth = imageSize.width * scale;
  const scaledImageHeight = imageSize.height * scale;

  return {
    imageSize,
    displaySize,
    fitMode,

    normalizedToScreen(point: [number, number]): Point {
      const [nx, ny] = point;

      // Normalized coords are 0..1 relative to the original image
      // First, map to scaled image coordinates, then add offset
      const x = nx * scaledImageWidth + offsetX;
      const y = ny * scaledImageHeight + offsetY;

      return { x, y };
    },

    screenToNormalized(point: Point): [number, number] {
      const { x, y } = point;

      // Remove offset, then scale back to 0..1
      const nx = (x - offsetX) / scaledImageWidth;
      const ny = (y - offsetY) / scaledImageHeight;

      return [nx, ny];
    },

    getLetterboxOffsets(): { x: number; y: number } {
      // In cover mode, offsets can be negative (cropping)
      // Only return positive offsets (actual letterbox/pillarbox space)
      return {
        x: Math.max(0, offsetX),
        y: Math.max(0, offsetY),
      };
    },

    getScaleFactor(): number {
      return scale;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform a polygon (array of normalized points) to screen coordinates.
 */
export function transformPolygonToScreen(
  polygon: [number, number][],
  mapper: CoordinateMapper
): Point[] {
  return polygon.map((point) => mapper.normalizedToScreen(point));
}

/**
 * Transform an array of points from normalized to screen coordinates.
 */
export function transformPathToScreen(
  path: [number, number][],
  mapper: CoordinateMapper
): Point[] {
  return path.map((point) => mapper.normalizedToScreen(point));
}

/**
 * Check if a screen point is within the visible image area.
 * Useful for cover mode where parts of the image may be cropped.
 */
export function isPointInVisibleArea(
  point: Point,
  displaySize: Size
): boolean {
  return (
    point.x >= 0 &&
    point.x <= displaySize.width &&
    point.y >= 0 &&
    point.y <= displaySize.height
  );
}

/**
 * Clamp a normalized coordinate to the valid 0..1 range.
 */
export function clampNormalized(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Clamp a point to be within display bounds.
 */
export function clampPointToDisplay(point: Point, displaySize: Size): Point {
  return {
    x: Math.max(0, Math.min(displaySize.width, point.x)),
    y: Math.max(0, Math.min(displaySize.height, point.y)),
  };
}

/**
 * Calculate the center point of a polygon in screen coordinates.
 */
export function getPolygonCenter(polygon: Point[]): Point {
  if (polygon.length === 0) {
    return { x: 0, y: 0 };
  }

  const sum = polygon.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length,
  };
}

/**
 * Calculate bounding box of a polygon.
 */
export function getPolygonBounds(
  polygon: Point[]
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (polygon.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return polygon.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxX: Math.max(acc.maxX, point.x),
      maxY: Math.max(acc.maxY, point.y),
    }),
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }
  );
}
