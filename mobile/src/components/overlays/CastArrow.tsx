/**
 * CastSense Cast Arrow Component
 *
 * Renders cast direction arrows with arrowheads using react-native-skia.
 * Supports optional animated dashed line effect.
 */

import React, { useMemo } from 'react';
import {
  Path,
  Skia,
  LinearGradient,
  vec,
  DashPathEffect,
  Group,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import type { CoordinateMapper } from '../../utils/coordinate-mapping';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CastArrowProps {
  /** Arrow start point in normalized [0..1] coordinates */
  start: [number, number];
  /** Arrow end point in normalized [0..1] coordinates */
  end: [number, number];
  /** Coordinate mapper for transforming to screen coords */
  mapper: CoordinateMapper;
  /** Whether to animate the arrow with a dashed effect */
  animated?: boolean;
  /** Whether this arrow is for the selected zone */
  isSelected?: boolean;
  /** Custom stroke width */
  strokeWidth?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Arrow colors - orange/red gradient
const ARROW_COLOR_START = '#FF6B35'; // Orange
const ARROW_COLOR_END = '#F72C25'; // Red

// Selected colors - brighter
const SELECTED_COLOR_START = '#FF8C5A';
const SELECTED_COLOR_END = '#FF4040';

// Arrow dimensions
const DEFAULT_STROKE_WIDTH = 4;
const SELECTED_STROKE_WIDTH = 6;
const ARROWHEAD_LENGTH = 16;
const ARROWHEAD_ANGLE = Math.PI / 6; // 30 degrees

// Animation
const DASH_LENGTH = 10;
const GAP_LENGTH = 8;
const ANIMATION_DURATION = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate arrowhead points given the end point and direction.
 */
function calculateArrowhead(
  endX: number,
  endY: number,
  angle: number,
  length: number
): { left: { x: number; y: number }; right: { x: number; y: number } } {
  const leftAngle = angle + Math.PI - ARROWHEAD_ANGLE;
  const rightAngle = angle + Math.PI + ARROWHEAD_ANGLE;

  return {
    left: {
      x: endX + length * Math.cos(leftAngle),
      y: endY + length * Math.sin(leftAngle),
    },
    right: {
      x: endX + length * Math.cos(rightAngle),
      y: endY + length * Math.sin(rightAngle),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders a cast direction arrow.
 *
 * The arrow shows the recommended casting direction from the angler's position
 * to the target zone. Includes an arrowhead at the end point.
 *
 * @example
 * <CastArrow
 *   start={zone.cast_arrow.start}
 *   end={zone.cast_arrow.end}
 *   mapper={coordinateMapper}
 *   animated={true}
 *   isSelected={selectedZoneId === zone.zone_id}
 * />
 */
export function CastArrow({
  start,
  end,
  mapper,
  animated = false,
  isSelected = false,
  strokeWidth: customStrokeWidth,
}: CastArrowProps): React.JSX.Element {
  // Transform to screen coordinates
  const startPoint = useMemo(
    () => mapper.normalizedToScreen(start),
    [start, mapper]
  );
  const endPoint = useMemo(
    () => mapper.normalizedToScreen(end),
    [end, mapper]
  );

  // Calculate arrow angle
  const angle = useMemo(() => {
    return Math.atan2(
      endPoint.y - startPoint.y,
      endPoint.x - startPoint.x
    );
  }, [startPoint, endPoint]);

  // Calculate arrowhead points
  const arrowhead = useMemo(
    () => calculateArrowhead(endPoint.x, endPoint.y, angle, ARROWHEAD_LENGTH),
    [endPoint, angle]
  );

  // Create line path
  const linePath = useMemo(() => {
    return Skia.Path.MakeFromSVGString(
      `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`
    );
  }, [startPoint, endPoint]);

  // Create arrowhead path
  const arrowheadPath = useMemo(() => {
    return Skia.Path.MakeFromSVGString(
      `M ${endPoint.x} ${endPoint.y} ` +
        `L ${arrowhead.left.x} ${arrowhead.left.y} ` +
        `M ${endPoint.x} ${endPoint.y} ` +
        `L ${arrowhead.right.x} ${arrowhead.right.y}`
    );
  }, [endPoint, arrowhead]);

  // Animation for dashed line effect
  const dashPhase = useSharedValue(0);

  // Start animation if enabled
  React.useEffect(() => {
    if (animated) {
      dashPhase.value = withRepeat(
        withTiming(DASH_LENGTH + GAP_LENGTH, {
          duration: ANIMATION_DURATION,
          easing: Easing.linear,
        }),
        -1, // infinite
        false // don't reverse
      );
    } else {
      dashPhase.value = 0;
    }
  }, [animated, dashPhase]);

  // Get colors based on selection state
  const colorStart = isSelected ? SELECTED_COLOR_START : ARROW_COLOR_START;
  const colorEnd = isSelected ? SELECTED_COLOR_END : ARROW_COLOR_END;

  // Stroke width
  const strokeWidthValue =
    customStrokeWidth ??
    (isSelected ? SELECTED_STROKE_WIDTH : DEFAULT_STROKE_WIDTH);

  if (!linePath || !arrowheadPath) {
    return <></>;
  }

  return (
    <Group>
      {/* Arrow line with gradient */}
      <Path
        path={linePath}
        style="stroke"
        strokeWidth={strokeWidthValue}
        strokeCap="round"
      >
        <LinearGradient
          start={vec(startPoint.x, startPoint.y)}
          end={vec(endPoint.x, endPoint.y)}
          colors={[colorStart, colorEnd]}
        />
        {animated && (
          <DashPathEffect intervals={[DASH_LENGTH, GAP_LENGTH]} phase={dashPhase} />
        )}
      </Path>

      {/* Arrowhead */}
      <Path
        path={arrowheadPath}
        style="stroke"
        strokeWidth={strokeWidthValue}
        strokeCap="round"
        color={colorEnd}
      />
    </Group>
  );
}

/**
 * Static (non-animated) cast arrow for better performance when animation
 * is not needed.
 */
export function CastArrowStatic({
  start,
  end,
  mapper,
  isSelected = false,
  strokeWidth: customStrokeWidth,
}: Omit<CastArrowProps, 'animated'>): React.JSX.Element {
  return (
    <CastArrow
      start={start}
      end={end}
      mapper={mapper}
      animated={false}
      isSelected={isSelected}
      strokeWidth={customStrokeWidth}
    />
  );
}
