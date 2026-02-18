/**
 * CastSense Overlay Canvas Component
 *
 * Main Skia canvas that combines all overlay elements:
 * - Zone polygons
 * - Cast arrows
 * - Retrieve paths
 *
 * Handles touch interactions for zone selection.
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group } from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import type { Zone } from '../../types/contracts';
import type { Point, Size, CoordinateMapper } from '../../utils/coordinate-mapping';
import { createCoordinateMapper } from '../../utils/coordinate-mapping';
import { hitTestWithExpansion } from '../../utils/polygon-hit-test';
import { ZoneOverlay } from './ZoneOverlay';
import { CastArrow } from './CastArrow';
import { RetrievePath } from './RetrievePath';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OverlayCanvasProps {
  /** Zones from the analysis result */
  zones: Zone[];
  /** Original image size in pixels */
  imageSize: Size;
  /** Display container size in pixels */
  displaySize: Size;
  /** How the image is fit to the display */
  fitMode?: 'contain' | 'cover';
  /** Currently selected zone ID */
  selectedZoneId?: string | null;
  /** Callback when a zone is selected */
  onZoneSelect?: (zoneId: string | null) => void;
  /** Whether to show cast arrows */
  showCastArrows?: boolean;
  /** Whether to show retrieve paths */
  showRetrievePaths?: boolean;
  /** Whether to animate cast arrows for selected zone */
  animateSelectedArrow?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main overlay canvas that renders all analysis visualization elements.
 *
 * Combines zone polygons, cast arrows, and retrieve paths in a single
 * Skia canvas. Handles touch interactions for zone selection.
 *
 * @example
 * <OverlayCanvas
 *   zones={analysisResult.zones}
 *   imageSize={{ width: 1920, height: 1080 }}
 *   displaySize={{ width: 375, height: 500 }}
 *   fitMode="contain"
 *   selectedZoneId={selectedZoneId}
 *   onZoneSelect={setSelectedZoneId}
 *   showCastArrows={true}
 *   showRetrievePaths={true}
 * />
 */
export function OverlayCanvas({
  zones,
  imageSize,
  displaySize,
  fitMode = 'contain',
  selectedZoneId = null,
  onZoneSelect,
  showCastArrows = true,
  showRetrievePaths = true,
  animateSelectedArrow = true,
}: OverlayCanvasProps): React.JSX.Element {
  // Create coordinate mapper
  const mapper = useMemo(
    () => createCoordinateMapper(imageSize, displaySize, fitMode),
    [imageSize, displaySize, fitMode]
  );

  // Sort zones by priority for rendering order (render lowest priority first)
  const sortedZones = useMemo(() => {
    return [...zones].sort((a, b) => {
      const priorityA = a.style?.priority ?? 999;
      const priorityB = b.style?.priority ?? 999;
      // Higher priority numbers render first (underneath)
      return priorityB - priorityA;
    });
  }, [zones]);

  // Handle touch for zone selection
  const handleTouch = useCallback(
    (point: Point) => {
      if (!onZoneSelect) return;

      const zone = hitTestWithExpansion(point, zones, mapper, 20);
      if (zone) {
        onZoneSelect(zone.zone_id);
      } else {
        // Tap outside zones - deselect
        onZoneSelect(null);
      }
    },
    [zones, mapper, onZoneSelect]
  );

  // Tap gesture handler
  const tapGesture = Gesture.Tap().onEnd((event: {x: number; y: number}) => {
    handleTouch({ x: event.x, y: event.y });
  });

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={tapGesture}>
        <View style={[styles.canvasContainer, { width: displaySize.width, height: displaySize.height }]}>
          <Canvas style={styles.canvas}>
            {/* Render zones (polygons) */}
            <Group>
              {sortedZones.map((zone) => (
                <ZoneOverlay
                  key={`zone-${zone.zone_id}`}
                  polygon={zone.polygon}
                  hint={zone.style?.hint}
                  priority={zone.style?.priority}
                  isSelected={selectedZoneId === zone.zone_id}
                  mapper={mapper}
                />
              ))}
            </Group>

            {/* Render retrieve paths (underneath arrows) */}
            {showRetrievePaths && (
              <Group>
                {sortedZones.map(
                  (zone) =>
                    zone.retrieve_path &&
                    zone.retrieve_path.length >= 2 && (
                      <RetrievePath
                        key={`retrieve-${zone.zone_id}`}
                        path={zone.retrieve_path}
                        mapper={mapper}
                        isSelected={selectedZoneId === zone.zone_id}
                      />
                    )
                )}
              </Group>
            )}

            {/* Render cast arrows (on top) */}
            {showCastArrows && (
              <Group>
                {sortedZones.map((zone) => (
                  <CastArrow
                    key={`arrow-${zone.zone_id}`}
                    start={zone.cast_arrow.start}
                    end={zone.cast_arrow.end}
                    mapper={mapper}
                    isSelected={selectedZoneId === zone.zone_id}
                    animated={
                      animateSelectedArrow && selectedZoneId === zone.zone_id
                    }
                  />
                ))}
              </Group>
            )}
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simplified Overlay (without gesture handling)
// ─────────────────────────────────────────────────────────────────────────────

export interface SimpleOverlayCanvasProps {
  zones: Zone[];
  imageSize: Size;
  displaySize: Size;
  fitMode?: 'contain' | 'cover';
  selectedZoneId?: string | null;
  showCastArrows?: boolean;
  showRetrievePaths?: boolean;
}

/**
 * Simplified overlay canvas without touch handling.
 * Use when gesture handling is managed externally or not needed.
 */
export function SimpleOverlayCanvas({
  zones,
  imageSize,
  displaySize,
  fitMode = 'contain',
  selectedZoneId = null,
  showCastArrows = true,
  showRetrievePaths = true,
}: SimpleOverlayCanvasProps): React.JSX.Element {
  // Create coordinate mapper
  const mapper = useMemo(
    () => createCoordinateMapper(imageSize, displaySize, fitMode),
    [imageSize, displaySize, fitMode]
  );

  // Sort zones by priority
  const sortedZones = useMemo(() => {
    return [...zones].sort((a, b) => {
      const priorityA = a.style?.priority ?? 999;
      const priorityB = b.style?.priority ?? 999;
      return priorityB - priorityA;
    });
  }, [zones]);

  return (
    <Canvas style={[styles.canvas, { width: displaySize.width, height: displaySize.height }]}>
      {/* Zones */}
      <Group>
        {sortedZones.map((zone) => (
          <ZoneOverlay
            key={`zone-${zone.zone_id}`}
            polygon={zone.polygon}
            hint={zone.style?.hint}
            priority={zone.style?.priority}
            isSelected={selectedZoneId === zone.zone_id}
            mapper={mapper}
          />
        ))}
      </Group>

      {/* Retrieve paths */}
      {showRetrievePaths && (
        <Group>
          {sortedZones.map(
            (zone) =>
              zone.retrieve_path &&
              zone.retrieve_path.length >= 2 && (
                <RetrievePath
                  key={`retrieve-${zone.zone_id}`}
                  path={zone.retrieve_path}
                  mapper={mapper}
                  isSelected={selectedZoneId === zone.zone_id}
                />
              )
          )}
        </Group>
      )}

      {/* Cast arrows */}
      {showCastArrows && (
        <Group>
          {sortedZones.map((zone) => (
            <CastArrow
              key={`arrow-${zone.zone_id}`}
              start={zone.cast_arrow.start}
              end={zone.cast_arrow.end}
              mapper={mapper}
              isSelected={selectedZoneId === zone.zone_id}
              animated={false}
            />
          ))}
        </Group>
      )}
    </Canvas>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvasContainer: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});
