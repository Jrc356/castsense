/**
 * CastSense Tactics Panel Component
 *
 * Bottom sheet/panel that displays tactics for the selected zone.
 * Shows recommended rig, target depth, retrieve style, and reasoning.
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';

import type { Tactic, Zone } from '../types/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TacticsPanelProps {
  /** All tactics from the analysis result */
  tactics: Tactic[];
  /** All zones from the analysis result */
  zones: Zone[];
  /** Currently selected zone ID */
  selectedZoneId: string | null;
  /** Callback when panel is dismissed */
  onDismiss?: () => void;
  /** Whether the panel is expanded */
  expanded?: boolean;
  /** Callback when expansion state changes */
  onExpandedChange?: (expanded: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_MIN_HEIGHT = 120;
const PANEL_MAX_HEIGHT = SCREEN_HEIGHT * 0.6;
const DRAG_THRESHOLD = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tactics panel that displays detailed fishing recommendations.
 *
 * Shows information about the selected zone including:
 * - Recommended rig setup
 * - Target depth
 * - Retrieve style and cadence
 * - Why this zone works
 * - Step-by-step instructions
 *
 * @example
 * <TacticsPanel
 *   tactics={analysisResult.tactics}
 *   zones={analysisResult.zones}
 *   selectedZoneId={selectedZoneId}
 *   expanded={isPanelExpanded}
 *   onExpandedChange={setIsPanelExpanded}
 * />
 */
export function TacticsPanel({
  tactics,
  zones,
  selectedZoneId,
  onDismiss,
  expanded = false,
  onExpandedChange,
}: TacticsPanelProps): React.JSX.Element | null {
  // Find selected zone and its tactics
  const selectedZone = useMemo(
    () => zones.find((z) => z.zone_id === selectedZoneId),
    [zones, selectedZoneId]
  );

  const selectedTactics = useMemo(
    () => tactics.find((t) => t.zone_id === selectedZoneId),
    [tactics, selectedZoneId]
  );

  // Panel height animation
  const panelHeight = React.useRef(
    new Animated.Value(expanded ? PANEL_MAX_HEIGHT : PANEL_MIN_HEIGHT)
  ).current;

  // Update height when expanded prop changes
  React.useEffect(() => {
    Animated.spring(panelHeight, {
      toValue: expanded ? PANEL_MAX_HEIGHT : PANEL_MIN_HEIGHT,
      useNativeDriver: false,
      friction: 10,
      tension: 50,
    }).start();
  }, [expanded, panelHeight]);

  // Handle drag gesture
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
          const currentHeight = expanded ? PANEL_MAX_HEIGHT : PANEL_MIN_HEIGHT;
          const newHeight = currentHeight - gestureState.dy;
          const clampedHeight = Math.max(
            PANEL_MIN_HEIGHT,
            Math.min(PANEL_MAX_HEIGHT, newHeight)
          );
          panelHeight.setValue(clampedHeight);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > DRAG_THRESHOLD && expanded) {
            onExpandedChange?.(false);
          } else if (gestureState.dy < -DRAG_THRESHOLD && !expanded) {
            onExpandedChange?.(true);
          } else {
            // Snap back
            Animated.spring(panelHeight, {
              toValue: expanded ? PANEL_MAX_HEIGHT : PANEL_MIN_HEIGHT,
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    [expanded, panelHeight, onExpandedChange]
  );

  // Toggle expanded state
  const handleToggleExpand = useCallback(() => {
    onExpandedChange?.(!expanded);
  }, [expanded, onExpandedChange]);

  // Don't render if no zone selected
  if (!selectedZoneId || !selectedTactics) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { height: panelHeight }]}>
      {/* Drag handle */}
      <View {...panResponder.panHandlers} style={styles.handleContainer}>
        <TouchableOpacity onPress={handleToggleExpand} style={styles.handleTouchArea}>
          <View style={styles.handle} />
        </TouchableOpacity>
      </View>

      {/* Zone header */}
      <View style={styles.header}>
        <Text style={styles.zoneLabel}>{selectedZone?.label || 'Zone'}</Text>
        <Text style={styles.targetSpecies}>
          Target: {selectedZone?.target_species}
        </Text>
        {selectedZone?.confidence && (
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {Math.round(selectedZone.confidence * 100)}% confidence
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Quick Info Grid */}
        <View style={styles.quickInfoGrid}>
          <QuickInfoItem label="Rig" value={selectedTactics.recommended_rig} />
          <QuickInfoItem label="Depth" value={selectedTactics.target_depth} />
          <QuickInfoItem label="Retrieve" value={selectedTactics.retrieve_style} />
          {selectedTactics.cadence && (
            <QuickInfoItem label="Cadence" value={selectedTactics.cadence} />
          )}
        </View>

        {/* Alternate rigs */}
        {selectedTactics.alternate_rigs &&
          selectedTactics.alternate_rigs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Alternative Rigs</Text>
              <Text style={styles.alternateRigs}>
                {selectedTactics.alternate_rigs.join(', ')}
              </Text>
            </View>
          )}

        {/* Cast suggestion */}
        {selectedTactics.cast_count_suggestion && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cast Suggestion</Text>
            <Text style={styles.sectionText}>
              {selectedTactics.cast_count_suggestion}
            </Text>
          </View>
        )}

        {/* Why this zone works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why This Zone Works</Text>
          {selectedTactics.why_this_zone_works.map((reason, index) => (
            <View key={index} style={styles.bulletItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{reason}</Text>
            </View>
          ))}
        </View>

        {/* Steps */}
        {selectedTactics.steps && selectedTactics.steps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Steps</Text>
            {selectedTactics.steps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick Info Item Component
// ─────────────────────────────────────────────────────────────────────────────

interface QuickInfoItemProps {
  label: string;
  value: string;
}

function QuickInfoItem({ label, value }: QuickInfoItemProps): React.JSX.Element {
  return (
    <View style={styles.quickInfoItem}>
      <Text style={styles.quickInfoLabel}>{label}</Text>
      <Text style={styles.quickInfoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact Tactics Panel (for inline use)
// ─────────────────────────────────────────────────────────────────────────────

export interface CompactTacticsPanelProps {
  tactics: Tactic | null;
  zone: Zone | null;
}

/**
 * Compact version of tactics panel for inline display.
 */
export function CompactTacticsPanel({
  tactics,
  zone,
}: CompactTacticsPanelProps): React.JSX.Element | null {
  if (!tactics || !zone) {
    return null;
  }

  return (
    <View style={styles.compactContainer}>
      <View style={styles.compactHeader}>
        <Text style={styles.compactLabel}>{zone.label}</Text>
        <Text style={styles.compactSpecies}>{zone.target_species}</Text>
      </View>

      <View style={styles.compactRow}>
        <Text style={styles.compactKey}>Rig:</Text>
        <Text style={styles.compactValue}>{tactics.recommended_rig}</Text>
      </View>

      <View style={styles.compactRow}>
        <Text style={styles.compactKey}>Depth:</Text>
        <Text style={styles.compactValue}>{tactics.target_depth}</Text>
      </View>

      <View style={styles.compactRow}>
        <Text style={styles.compactKey}>Retrieve:</Text>
        <Text style={styles.compactValue}>{tactics.retrieve_style}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleTouchArea: {
    padding: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  zoneLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  targetSpecies: {
    fontSize: 14,
    color: '#6B7280',
  },
  confidenceBadge: {
    position: 'absolute',
    right: 20,
    top: 0,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  quickInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginBottom: 16,
  },
  quickInfoItem: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  quickInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  quickInfoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  alternateRigs: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bullet: {
    fontSize: 15,
    color: '#10B981',
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    paddingTop: 2,
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  compactLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  compactSpecies: {
    fontSize: 13,
    color: '#6B7280',
  },
  compactRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  compactKey: {
    width: 70,
    fontSize: 14,
    color: '#6B7280',
  },
  compactValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
});
