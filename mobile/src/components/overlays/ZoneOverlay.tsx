/**
 * CastSense Zone Overlay Component
 *
 * Renders zone polygons with filled areas and stroked outlines
 * using react-native-skia.
 */

import React, { useMemo } from 'react';
import { Path, Skia } from '@shopify/react-native-skia';

import type { Point, CoordinateMapper } from '../../utils/coordinate-mapping';
import { transformPolygonToScreen } from '../../utils/coordinate-mapping';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ZoneHint =
  | 'cover'
  | 'structure'
  | 'current'
  | 'depth_edge'
  | 'shade'
  | 'inflow'
  | 'unknown';

export interface ZoneOverlayProps {
  /** Polygon vertices in normalized [0..1] coordinates */
  polygon: [number, number][];
  /** Style hint for color selection */
  hint?: ZoneHint;
  /** Priority for rendering (affects visual prominence) */
  priority?: number;
  /** Whether this zone is currently selected */
  isSelected?: boolean;
  /** Coordinate mapper for transforming to screen coords */
  mapper: CoordinateMapper;
}

interface ZoneColors {
  fill: string;
  stroke: string;
  selectedFill: string;
  selectedStroke: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zone colors by hint type.
 * Each hint has a base color with semi-transparent fill and solid stroke.
 */
const ZONE_COLOR_MAP: Record<ZoneHint, ZoneColors> = {
  cover: {
    fill: 'rgba(34, 197, 94, 0.4)', // green
    stroke: 'rgba(34, 197, 94, 1)',
    selectedFill: 'rgba(34, 197, 94, 0.6)',
    selectedStroke: 'rgba(34, 197, 94, 1)',
  },
  structure: {
    fill: 'rgba(59, 130, 246, 0.4)', // blue
    stroke: 'rgba(59, 130, 246, 1)',
    selectedFill: 'rgba(59, 130, 246, 0.6)',
    selectedStroke: 'rgba(59, 130, 246, 1)',
  },
  current: {
    fill: 'rgba(6, 182, 212, 0.4)', // cyan
    stroke: 'rgba(6, 182, 212, 1)',
    selectedFill: 'rgba(6, 182, 212, 0.6)',
    selectedStroke: 'rgba(6, 182, 212, 1)',
  },
  depth_edge: {
    fill: 'rgba(168, 85, 247, 0.4)', // purple
    stroke: 'rgba(168, 85, 247, 1)',
    selectedFill: 'rgba(168, 85, 247, 0.6)',
    selectedStroke: 'rgba(168, 85, 247, 1)',
  },
  shade: {
    fill: 'rgba(107, 114, 128, 0.4)', // gray
    stroke: 'rgba(107, 114, 128, 1)',
    selectedFill: 'rgba(107, 114, 128, 0.6)',
    selectedStroke: 'rgba(107, 114, 128, 1)',
  },
  inflow: {
    fill: 'rgba(20, 184, 166, 0.4)', // teal
    stroke: 'rgba(20, 184, 166, 1)',
    selectedFill: 'rgba(20, 184, 166, 0.6)',
    selectedStroke: 'rgba(20, 184, 166, 1)',
  },
  unknown: {
    fill: 'rgba(251, 146, 60, 0.4)', // orange
    stroke: 'rgba(251, 146, 60, 1)',
    selectedFill: 'rgba(251, 146, 60, 0.6)',
    selectedStroke: 'rgba(251, 146, 60, 1)',
  },
};

// Stroke widths
const NORMAL_STROKE_WIDTH = 2;
const SELECTED_STROKE_WIDTH = 4;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get zone colors based on hint type.
 */
export function getZoneColor(hint?: ZoneHint): ZoneColors {
  return ZONE_COLOR_MAP[hint || 'unknown'];
}

/**
 * Create a Skia path from screen-space polygon points.
 */
function createPolygonPath(points: Point[]): string {
  if (points.length < 3) {
    return '';
  }

  const pathParts: string[] = [];
  pathParts.push(`M ${points[0].x} ${points[0].y}`);

  for (let i = 1; i < points.length; i++) {
    pathParts.push(`L ${points[i].x} ${points[i].y}`);
  }

  pathParts.push('Z'); // Close the path

  return pathParts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a zone polygon overlay.
 *
 * The polygon is rendered with a semi-transparent fill and a solid stroke.
 * Selected zones have a brighter fill and thicker stroke.
 *
 * @example
 * <ZoneOverlay
 *   polygon={zone.polygon}
 *   hint={zone.style?.hint}
 *   priority={zone.style?.priority}
 *   isSelected={selectedZoneId === zone.zone_id}
 *   mapper={coordinateMapper}
 * />
 */
export function ZoneOverlay({
  polygon,
  hint = 'unknown',
  priority = 999,
  isSelected = false,
  mapper,
}: ZoneOverlayProps): React.JSX.Element | null {
  // Transform polygon to screen coordinates
  const screenPolygon = useMemo(
    () => transformPolygonToScreen(polygon, mapper),
    [polygon, mapper]
  );

  // Create Skia path
  const pathString = useMemo(
    () => createPolygonPath(screenPolygon),
    [screenPolygon]
  );

  const path = useMemo(() => {
    if (!pathString) return null;
    return Skia.Path.MakeFromSVGString(pathString);
  }, [pathString]);

  // Get colors based on hint
  const colors = useMemo(() => getZoneColor(hint), [hint]);

  // Adjust opacity based on priority (higher priority = more prominent)
  const priorityOpacity = useMemo(() => {
    // Priority 1 is highest, so we want higher opacity for lower numbers
    const normalized = Math.max(1, Math.min(10, priority));
    return 1 - (normalized - 1) * 0.05; // 1 -> 1.0, 10 -> 0.55
  }, [priority]);

  if (!path) {
    return null;
  }

  const fillColor = isSelected ? colors.selectedFill : colors.fill;
  const strokeColor = isSelected ? colors.selectedStroke : colors.stroke;
  const strokeWidth = isSelected ? SELECTED_STROKE_WIDTH : NORMAL_STROKE_WIDTH;

  return (
    <>
      {/* Fill */}
      <Path
        path={path}
        color={fillColor}
        style="fill"
        opacity={priorityOpacity}
      />
      {/* Stroke */}
      <Path
        path={path}
        color={strokeColor}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
        opacity={priorityOpacity}
      />
    </>
  );
}
