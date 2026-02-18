/**
 * CastSense Retrieve Path Component
 *
 * Renders retrieve path as a polyline with a dotted style.
 * Shows the recommended path for retrieving the lure.
 */

import React, { useMemo } from 'react';
import { Path, Skia, DashPathEffect, Group } from '@shopify/react-native-skia';

import type { Point, CoordinateMapper } from '../../utils/coordinate-mapping';
import { transformPathToScreen } from '../../utils/coordinate-mapping';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RetrievePathProps {
  /** Path points in normalized [0..1] coordinates */
  path: [number, number][];
  /** Coordinate mapper for transforming to screen coords */
  mapper: CoordinateMapper;
  /** Whether this path is for the selected zone */
  isSelected?: boolean;
  /** Custom stroke width */
  strokeWidth?: number;
  /** Custom color override */
  color?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Path colors - blue dotted line style
const PATH_COLOR = '#3B82F6'; // Blue
const SELECTED_PATH_COLOR = '#60A5FA'; // Lighter blue

// Stroke dimensions
const DEFAULT_STROKE_WIDTH = 3;
const SELECTED_STROKE_WIDTH = 4;

// Dotted line pattern
const DOT_LENGTH = 4;
const GAP_LENGTH = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create SVG path string from array of points.
 */
function createPolylinePath(points: Point[]): string {
  if (points.length < 2) {
    return '';
  }

  const pathParts: string[] = [];
  pathParts.push(`M ${points[0].x} ${points[0].y}`);

  for (let i = 1; i < points.length; i++) {
    pathParts.push(`L ${points[i].x} ${points[i].y}`);
  }

  return pathParts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a retrieve path polyline.
 *
 * The path shows the recommended retrieve trajectory for the lure.
 * Rendered as a dotted/dashed blue line to differentiate from cast arrows.
 *
 * @example
 * {zone.retrieve_path && (
 *   <RetrievePath
 *     path={zone.retrieve_path}
 *     mapper={coordinateMapper}
 *     isSelected={selectedZoneId === zone.zone_id}
 *   />
 * )}
 */
export function RetrievePath({
  path,
  mapper,
  isSelected = false,
  strokeWidth: customStrokeWidth,
  color: customColor,
}: RetrievePathProps): React.JSX.Element | null {
  // Transform to screen coordinates
  const screenPath = useMemo(
    () => transformPathToScreen(path, mapper),
    [path, mapper]
  );

  // Create Skia path
  const pathString = useMemo(
    () => createPolylinePath(screenPath),
    [screenPath]
  );

  const skiaPath = useMemo(() => {
    if (!pathString) return null;
    return Skia.Path.MakeFromSVGString(pathString);
  }, [pathString]);

  // Get styling
  const pathColor = customColor ?? (isSelected ? SELECTED_PATH_COLOR : PATH_COLOR);
  const strokeWidthValue =
    customStrokeWidth ??
    (isSelected ? SELECTED_STROKE_WIDTH : DEFAULT_STROKE_WIDTH);

  if (!skiaPath || path.length < 2) {
    return null;
  }

  return (
    <Group>
      {/* Dotted path line */}
      <Path
        path={skiaPath}
        style="stroke"
        strokeWidth={strokeWidthValue}
        strokeCap="round"
        strokeJoin="round"
        color={pathColor}
      >
        <DashPathEffect intervals={[DOT_LENGTH, GAP_LENGTH]} />
      </Path>

      {/* Optional: End marker (small circle at the end) */}
      {screenPath.length > 0 && (
        <EndMarker
          point={screenPath[screenPath.length - 1]}
          color={pathColor}
          radius={isSelected ? 4 : 3}
        />
      )}
    </Group>
  );
}

/**
 * End marker component - small circle at the end of the retrieve path.
 */
function EndMarker({
  point,
  color,
  radius,
}: {
  point: Point;
  color: string;
  radius: number;
}): React.JSX.Element {
  const circlePath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(point.x, point.y, radius);
    return path;
  }, [point, radius]);

  return <Path path={circlePath} color={color} style="fill" />;
}

/**
 * Animated retrieve path with flowing dots effect.
 * Use sparingly as it requires continuous animation.
 */
export function RetrievePathAnimated(
  props: RetrievePathProps
): React.JSX.Element | null {
  // For now, just use the static version
  // Animation can be added similar to CastArrow if needed
  return <RetrievePath {...props} />;
}
