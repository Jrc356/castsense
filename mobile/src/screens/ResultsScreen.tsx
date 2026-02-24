/**
 * CastSense Results Screen
 * 
 * Displays analysis results with:
 * - Overlay visualization on captured image using Skia
 * - Zone selection and tactics display
 * - Text-only mode when overlay is unavailable
 * - Conditions summary
 * - Plan summary
 */

import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAppNavigation, useResultsRoute} from '../navigation/hooks';
import {useApp} from '../state/AppContext';
import type {CastSenseAnalysisResult, Tactic} from '../types/contracts';
import {OverlayCanvas} from '../components/overlays';
import {TacticsPanel} from '../components/TacticsPanel';
import {TextOnlyResults} from '../components/TextOnlyResults';
import type {Size} from '../utils/coordinate-mapping';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const IMAGE_ASPECT_RATIO = 4 / 3;
const IMAGE_HEIGHT = SCREEN_WIDTH / IMAGE_ASPECT_RATIO;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Zone {
  zone_id: string;
  label: string;
  confidence: number;
  target_species: string;
  polygon: [number, number][];
  cast_arrow: {
    start: [number, number];
    end: [number, number];
  };
  retrieve_path?: [number, number][];
  style?: {
    priority?: number;
    hint?: 'cover' | 'structure' | 'current' | 'depth_edge' | 'shade' | 'inflow' | 'unknown';
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Parse zones from result (handles complex union type)
// ─────────────────────────────────────────────────────────────────────────────

function parseZones(result: CastSenseAnalysisResult | undefined): Zone[] {
  if (!result?.zones) return [];
  // The zones type is a complex union, but at runtime it's just an array
  return (result.zones as unknown as Zone[]) || [];
}

function parseTactics(result: CastSenseAnalysisResult | undefined): Tactic[] {
  if (!result) return [];
  return (result.tactics as Tactic[]) || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function ResultsScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const route = useResultsRoute();
  const {reset, retry} = useApp();

  const {result, mediaUri} = route.params;
  const analysisResult = result.result as CastSenseAnalysisResult | undefined;
  
  // Parse zones and tactics
  const zones = useMemo(() => parseZones(analysisResult), [analysisResult]);
  const tactics = useMemo(() => parseTactics(analysisResult), [analysisResult]);
  
  // Selected zone
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    zones.length > 0 ? zones[0].zone_id : null
  );

  // Tactics panel expanded state
  const [tacticsPanelExpanded, setTacticsPanelExpanded] = useState(false);

  // Display size state for overlay
  const [displaySize, setDisplaySize] = useState<Size>({
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  });

  // Image size from analysis frame or default
  const imageSize = useMemo<Size>(() => {
    if (analysisResult?.analysis_frame) {
      return {
        width: analysisResult.analysis_frame.width_px,
        height: analysisResult.analysis_frame.height_px,
      };
    }
    // Default to 4:3 aspect ratio at 1920x1440
    return { width: 1920, height: 1440 };
  }, [analysisResult?.analysis_frame]);

  // Get selected zone and its tactics
  const selectedZone = useMemo(
    () => zones.find(z => z.zone_id === selectedZoneId),
    [zones, selectedZoneId]
  );
  
  const selectedTactics = useMemo(
    () => tactics.find(t => t.zone_id === selectedZoneId),
    [tactics, selectedZoneId]
  );

  // Update selected zone when zones change
  useEffect(() => {
    if (zones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(zones[0].zone_id);
    }
  }, [zones, selectedZoneId]);

  // Handle zone selection from overlay
  const handleZoneSelect = useCallback((zoneId: string | null) => {
    if (zoneId) {
      setSelectedZoneId(zoneId);
      // Expand tactics panel when zone is selected
      setTacticsPanelExpanded(true);
    }
  }, []);

  // Handle media container layout to get display size
  const handleMediaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setDisplaySize({ width, height });
  }, []);

  // Handle new analysis
  const handleNewAnalysis = useCallback(() => {
    reset();
    navigation.popToTop();
  }, [reset, navigation]);

  // Handle retry for degraded/error status
  const handleRetry = useCallback(() => {
    retry();
    navigation.goBack();
  }, [retry, navigation]);

  // Check if text-only mode
  const isTextOnly = result.rendering_mode === 'text_only' || zones.length === 0;

  // Check if degraded or error status that allows retry
  const canRetry = result.status === 'degraded' || result.status === 'error';

  // If text-only mode, show the text-only results component
  if (isTextOnly && analysisResult) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView style={styles.scrollView} bounces={false}>
          {/* Media Preview (without overlay) */}
          <View style={styles.mediaContainer}>
            <Image
              source={{uri: mediaUri}}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          </View>

          {/* Status Badge */}
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusBadge,
              result.status === 'ok' && styles.statusOk,
              result.status === 'degraded' && styles.statusDegraded,
              result.status === 'error' && styles.statusError,
            ]}>
              <Text style={styles.statusText}>
                {result.status === 'ok' ? 'Analysis Complete' :
                 result.status === 'degraded' ? 'Partial Analysis' : 'Limited Analysis'}
              </Text>
            </View>
          </View>

          {/* Text-only results */}
          <TextOnlyResults 
            result={analysisResult}
            unavailableReason={
              zones.length === 0 
                ? 'No castable zones identified in this image. Try capturing a different angle or location.'
                : undefined
            }
          />

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {canRetry && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Text style={styles.retryButtonText}>Retry Analysis</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.newAnalysisButton}
              onPress={handleNewAnalysis}
              activeOpacity={0.8}
            >
              <Text style={styles.newAnalysisButtonText}>New Analysis</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} bounces={false}>
        {/* Media Preview with Skia Overlay */}
        <View style={styles.mediaContainer} onLayout={handleMediaLayout}>
          <Image
            source={{uri: mediaUri}}
            style={styles.mediaImage}
            resizeMode="contain"
          />
          
          {/* Skia Overlay Canvas */}
          {zones.length > 0 && (
            <View style={styles.overlayContainer}>
              <OverlayCanvas
                zones={zones as any}
                imageSize={imageSize}
                displaySize={displaySize}
                fitMode="contain"
                selectedZoneId={selectedZoneId}
                onZoneSelect={handleZoneSelect}
                showCastArrows={true}
                showRetrievePaths={true}
                animateSelectedArrow={true}
              />
            </View>
          )}
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusBadge,
            result.status === 'ok' && styles.statusOk,
            result.status === 'degraded' && styles.statusDegraded,
            result.status === 'error' && styles.statusError,
          ]}>
            <Text style={styles.statusText}>
              {result.status === 'ok' ? 'Analysis Complete' :
               result.status === 'degraded' ? 'Partial Analysis' : 'Limited Analysis'}
            </Text>
          </View>
        </View>

        {/* Species Identification */}
        {analysisResult?.likely_species && analysisResult.likely_species.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Likely Species</Text>
            <View style={styles.speciesList}>
              {analysisResult.likely_species.map((species, index) => (
                <View key={index} style={styles.speciesItem}>
                  <Text style={styles.speciesName}>{species.species}</Text>
                  <Text style={styles.speciesConfidence}>
                    {Math.round(species.confidence * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Zone Selector */}
        {zones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cast Zones</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.zoneSelector}
            >
              {zones.map((zone) => (
                <TouchableOpacity
                  key={zone.zone_id}
                  style={[
                    styles.zoneSelectorItem,
                    selectedZoneId === zone.zone_id && styles.zoneSelectorItemSelected,
                  ]}
                  onPress={() => handleZoneSelect(zone.zone_id)}
                >
                  <Text style={[
                    styles.zoneSelectorLabel,
                    selectedZoneId === zone.zone_id && styles.zoneSelectorLabelSelected,
                  ]}>
                    {zone.label}
                  </Text>
                  <Text style={styles.zoneSelectorSpecies}>
                    {zone.target_species}
                  </Text>
                  <View style={[
                    styles.zoneSelectorConfidence,
                    selectedZoneId === zone.zone_id && styles.zoneSelectorConfidenceSelected,
                  ]}>
                    <Text style={styles.zoneSelectorConfidenceText}>
                      {Math.round(zone.confidence * 100)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Selected Zone Tactics */}
        {selectedTactics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Tactics - {selectedZone?.label || 'Zone'}
            </Text>
            
            <View style={styles.tacticsCard}>
              {/* Recommended Rig */}
              <View style={styles.tacticsRow}>
                <Text style={styles.tacticsLabel}>Recommended Rig</Text>
                <Text style={styles.tacticsValue}>{selectedTactics.recommended_rig}</Text>
              </View>

              {/* Alternate Rigs */}
              {selectedTactics.alternate_rigs && selectedTactics.alternate_rigs.length > 0 && (
                <View style={styles.tacticsRow}>
                  <Text style={styles.tacticsLabel}>Alternatives</Text>
                  <Text style={styles.tacticsValue}>
                    {selectedTactics.alternate_rigs.join(', ')}
                  </Text>
                </View>
              )}

              {/* Target Depth */}
              <View style={styles.tacticsRow}>
                <Text style={styles.tacticsLabel}>Target Depth</Text>
                <Text style={styles.tacticsValue}>{selectedTactics.target_depth}</Text>
              </View>

              {/* Retrieve Style */}
              <View style={styles.tacticsRow}>
                <Text style={styles.tacticsLabel}>Retrieve</Text>
                <Text style={styles.tacticsValue}>{selectedTactics.retrieve_style}</Text>
              </View>

              {/* Cadence */}
              {selectedTactics.cadence && (
                <View style={styles.tacticsRow}>
                  <Text style={styles.tacticsLabel}>Cadence</Text>
                  <Text style={styles.tacticsValue}>{selectedTactics.cadence}</Text>
                </View>
              )}

              {/* Why This Zone Works */}
              <View style={styles.tacticsSection}>
                <Text style={styles.tacticsSectionTitle}>Why This Zone Works</Text>
                {selectedTactics.why_this_zone_works.map((reason, index) => (
                  <Text key={index} style={styles.bulletPoint}>• {reason}</Text>
                ))}
              </View>

              {/* Steps */}
              {selectedTactics.steps && selectedTactics.steps.length > 0 && (
                <View style={styles.tacticsSection}>
                  <Text style={styles.tacticsSectionTitle}>Steps</Text>
                  {selectedTactics.steps.map((step, index) => (
                    <Text key={index} style={styles.bulletPoint}>
                      {index + 1}. {step}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Conditions Summary */}
        {analysisResult?.conditions_summary && analysisResult.conditions_summary.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conditions</Text>
            <View style={styles.summaryCard}>
              {analysisResult.conditions_summary.map((condition: string, index: number) => (
                <Text key={index} style={styles.summaryText}>• {condition}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Plan Summary */}
        {analysisResult?.plan_summary && analysisResult.plan_summary.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Plan Summary</Text>
            <View style={styles.summaryCard}>
              {analysisResult.plan_summary.map((item: string, index: number) => (
                <Text key={index} style={styles.summaryText}>• {item}</Text>
              ))}
            </View>
          </View>
        )}

        {/* New Analysis Button */}
        <View style={styles.buttonContainer}>
          {canRetry && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Retry Analysis</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.newAnalysisButton}
            onPress={handleNewAnalysis}
            activeOpacity={0.8}
          >
            <Text style={styles.newAnalysisButtonText}>New Analysis</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Tactics Panel (bottom sheet) */}
      {selectedZoneId && tactics.length > 0 && (
        <TacticsPanel
          tactics={tactics as Tactic[]}
          zones={zones as any}
          selectedZoneId={selectedZoneId}
          expanded={tacticsPanelExpanded}
          onExpandedChange={setTacticsPanelExpanded}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  scrollView: {
    flex: 1,
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#000000',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  zoneLabel: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    transform: [{translateX: -30}, {translateY: -15}],
  },
  zoneLabelSelected: {
    transform: [{translateX: -30}, {translateY: -15}, {scale: 1.1}],
  },
  zoneLabelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  statusContainer: {
    padding: 16,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#8e8e93',
  },
  statusOk: {
    backgroundColor: '#34C759',
  },
  statusDegraded: {
    backgroundColor: '#FF9500',
  },
  statusError: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  textOnlyNote: {
    marginTop: 8,
    fontSize: 13,
    color: '#8e8e93',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c6c70',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  speciesList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  speciesItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  speciesName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  speciesConfidence: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  zoneSelector: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  zoneSelectorItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e5ea',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 10,
    minWidth: 110,
  },
  zoneSelectorItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  },
  zoneSelectorLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  zoneSelectorLabelSelected: {
    color: '#007AFF',
  },
  zoneSelectorSpecies: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 6,
  },
  zoneSelectorConfidence: {
    backgroundColor: '#e5e5ea',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  zoneSelectorConfidenceSelected: {
    backgroundColor: '#D1E7FF',
  },
  zoneSelectorConfidenceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6c6c70',
  },
  tacticsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  tacticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  tacticsLabel: {
    fontSize: 14,
    color: '#8e8e93',
    flex: 1,
  },
  tacticsValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  tacticsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5ea',
  },
  tacticsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 22,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#FF9500',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  newAnalysisButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  newAnalysisButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
});
