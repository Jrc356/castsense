/**
 * CastSense Text-Only Results Component
 *
 * Displays analysis results in text-only mode when overlay rendering
 * is not available. Shows plan summary, tactics, and conditions.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import type { CastSenseAnalysisResult, Tactic } from '../types/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TextOnlyResultsProps {
  /** The analysis result */
  result: CastSenseAnalysisResult;
  /** Optional message explaining why overlay is unavailable */
  unavailableReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract plan summary from result (handles type complexity).
 */
function getPlanSummary(result: CastSenseAnalysisResult): string[] {
  // @ts-expect-error - plan_summary exists but type is complex
  return (result.plan_summary as string[]) || [];
}

/**
 * Extract conditions summary from result.
 */
function getConditionsSummary(result: CastSenseAnalysisResult): string[] {
  // @ts-expect-error - conditions_summary exists but type is complex
  return (result.conditions_summary as string[]) || [];
}

/**
 * Extract tactics from result.
 */
function getTactics(result: CastSenseAnalysisResult): Tactic[] {
  return (result.tactics as Tactic[]) || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Text-only results display for when overlay rendering is unavailable.
 *
 * This component shows all the fishing recommendations in a readable
 * text format, without the visual overlay on the image.
 *
 * @example
 * {renderingMode === 'text_only' && (
 *   <TextOnlyResults
 *     result={analysisResult}
 *     unavailableReason="Image quality too low for overlay"
 *   />
 * )}
 */
export function TextOnlyResults({
  result,
  unavailableReason,
}: TextOnlyResultsProps): React.JSX.Element {
  const planSummary = getPlanSummary(result);
  const conditionsSummary = getConditionsSummary(result);
  const tactics = getTactics(result);
  const likelySpecies = result.likely_species || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Overlay Unavailable Notice */}
      <View style={styles.noticeContainer}>
        <View style={styles.noticeIcon}>
          <Text style={styles.noticeIconText}>ℹ️</Text>
        </View>
        <View style={styles.noticeContent}>
          <Text style={styles.noticeTitle}>Visual Overlay Unavailable</Text>
          <Text style={styles.noticeText}>
            {unavailableReason ||
              'Showing text recommendations. Visual overlay could not be generated for this image.'}
          </Text>
        </View>
      </View>

      {/* Likely Species */}
      {likelySpecies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Likely Species</Text>
          <View style={styles.speciesGrid}>
            {likelySpecies.map((species, index) => (
              <View key={index} style={styles.speciesItem}>
                <Text style={styles.speciesName}>{species.species}</Text>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      { width: `${Math.round(species.confidence * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceText}>
                  {Math.round(species.confidence * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Plan Summary */}
      {planSummary.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Summary</Text>
          <View style={styles.summaryCard}>
            {planSummary.map((item, index) => (
              <View key={index} style={styles.summaryItem}>
                <Text style={styles.summaryBullet}>•</Text>
                <Text style={styles.summaryText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Conditions Summary */}
      {conditionsSummary.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Conditions</Text>
          <View style={styles.conditionsGrid}>
            {conditionsSummary.map((condition, index) => (
              <View key={index} style={styles.conditionItem}>
                <Text style={styles.conditionText}>{condition}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tactics for each zone */}
      {tactics.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fishing Tactics</Text>
          {tactics.map((tactic, index) => (
            <TacticCard key={tactic.zone_id || index} tactic={tactic} index={index} />
          ))}
        </View>
      )}

      {/* Empty state */}
      {planSummary.length === 0 &&
        conditionsSummary.length === 0 &&
        tactics.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Recommendations Available</Text>
            <Text style={styles.emptyStateText}>
              We couldn't generate fishing recommendations for this image. Try
              taking a clearer photo of the water with visible structure.
            </Text>
          </View>
        )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tactic Card Component
// ─────────────────────────────────────────────────────────────────────────────

interface TacticCardProps {
  tactic: Tactic;
  index: number;
}

function TacticCard({ tactic, index }: TacticCardProps): React.JSX.Element {
  return (
    <View style={styles.tacticCard}>
      <View style={styles.tacticHeader}>
        <View style={styles.tacticNumber}>
          <Text style={styles.tacticNumberText}>{index + 1}</Text>
        </View>
        <Text style={styles.tacticTitle}>Approach {index + 1}</Text>
      </View>

      {/* Quick info */}
      <View style={styles.tacticInfo}>
        <InfoRow label="Rig" value={tactic.recommended_rig} />
        <InfoRow label="Depth" value={tactic.target_depth} />
        <InfoRow label="Retrieve" value={tactic.retrieve_style} />
        {tactic.cadence && <InfoRow label="Cadence" value={tactic.cadence} />}
      </View>

      {/* Alternate rigs */}
      {tactic.alternate_rigs && tactic.alternate_rigs.length > 0 && (
        <View style={styles.tacticSection}>
          <Text style={styles.tacticSectionLabel}>Alternatives</Text>
          <Text style={styles.tacticSectionText}>
            {tactic.alternate_rigs.join(', ')}
          </Text>
        </View>
      )}

      {/* Why it works */}
      <View style={styles.tacticSection}>
        <Text style={styles.tacticSectionLabel}>Why This Works</Text>
        {tactic.why_this_zone_works.map((reason, i) => (
          <View key={i} style={styles.reasonItem}>
            <Text style={styles.reasonBullet}>✓</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ))}
      </View>

      {/* Steps */}
      {tactic.steps && tactic.steps.length > 0 && (
        <View style={styles.tacticSection}>
          <Text style={styles.tacticSectionLabel}>Steps</Text>
          {tactic.steps.map((step, i) => (
            <View key={i} style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Info Row Component
// ─────────────────────────────────────────────────────────────────────────────

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  // Notice
  noticeContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  noticeIcon: {
    marginRight: 12,
  },
  noticeIconText: {
    fontSize: 20,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 14,
    color: '#A16207',
    lineHeight: 20,
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  // Species
  speciesGrid: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  speciesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  speciesName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    width: 120,
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    width: 45,
    textAlign: 'right',
  },
  // Summary
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  summaryBullet: {
    fontSize: 15,
    color: '#3B82F6',
    marginRight: 10,
    lineHeight: 22,
  },
  summaryText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  // Conditions
  conditionsGrid: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  conditionItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  conditionText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  // Tactic Card
  tacticCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tacticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  tacticNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  tacticNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  tacticTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  tacticInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  tacticSection: {
    marginTop: 12,
  },
  tacticSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  tacticSectionText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  reasonBullet: {
    fontSize: 14,
    color: '#10B981',
    marginRight: 8,
    lineHeight: 20,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
