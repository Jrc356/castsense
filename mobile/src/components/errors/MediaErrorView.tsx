/**
 * MediaErrorView Component
 * 
 * Handles invalid media errors (INVALID_MEDIA)
 * Shows guidance for recapturing with better quality
 */

import React, {useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MediaErrorViewProps {
  /** Error message to display */
  message?: string;
  /** Specific validation issue if available */
  validationIssue?: string;
  /** Error details for debugging */
  details?: Record<string, unknown>;
  /** Callback when user wants to recapture */
  onRecapture: () => void;
  /** Callback when user wants to start over */
  onStartOver: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CAPTURE_TIPS = [
  {
    icon: '💡',
    title: 'Good Lighting',
    description: 'Capture in daylight or well-lit conditions. Avoid dark or overly bright scenes.',
  },
  {
    icon: '📐',
    title: 'Steady Camera',
    description: 'Hold your device steady. Avoid excessive shaking or motion blur.',
  },
  {
    icon: '🌊',
    title: 'Clear Subject',
    description: 'Focus on water features, structure, or the fishing spot you want analyzed.',
  },
  {
    icon: '📏',
    title: 'Proper Distance',
    description: 'Not too close, not too far. The scene should be clearly visible.',
  },
  {
    icon: '⏱️',
    title: 'Video Duration',
    description: 'For videos, 3-10 seconds is ideal. Longer isn\'t always better.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MediaErrorView({
  message = 'The captured photo or video could not be processed. Please try capturing again with the tips below.',
  validationIssue,
  details,
  onRecapture,
  onStartOver,
}: MediaErrorViewProps): React.JSX.Element {

  // Handle recapture
  const handleRecapture = useCallback(() => {
    onRecapture();
  }, [onRecapture]);

  return (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Icon */}
      <Text style={styles.icon}>📷</Text>

      {/* Title */}
      <Text style={styles.title}>Invalid Photo/Video</Text>

      {/* Error code badge */}
      <View style={styles.codeBadge}>
        <Text style={styles.codeText}>INVALID_MEDIA</Text>
      </View>

      {/* Message */}
      <Text style={styles.message}>{message}</Text>

      {/* Specific validation issue */}
      {validationIssue && (
        <View style={styles.issueContainer}>
          <Text style={styles.issueTitle}>Issue detected:</Text>
          <Text style={styles.issueText}>{validationIssue}</Text>
        </View>
      )}

      {/* Capture tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Tips for better captures:</Text>
        {CAPTURE_TIPS.map((tip, index) => (
          <View key={index} style={styles.tipCard}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
            <View style={styles.tipContent}>
              <Text style={styles.tipCardTitle}>{tip.title}</Text>
              <Text style={styles.tipDescription}>{tip.description}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Debug details (development only) */}
      {__DEV__ && details && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Info:</Text>
          <Text style={styles.debugText}>
            {JSON.stringify(details, null, 2)}
          </Text>
        </View>
      )}

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleRecapture}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Recapture</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onStartOver}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Start Over</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 24,
    paddingBottom: 48,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
    marginTop: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  codeBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  codeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  message: {
    fontSize: 16,
    color: '#3c3c43',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  issueContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  issueText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
  },
  tipsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  tipCard: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tipIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  tipDescription: {
    fontSize: 13,
    color: '#3c3c43',
    lineHeight: 18,
  },
  debugContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 24,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#333333',
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  button: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e5e5ea',
  },
  secondaryButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default MediaErrorView;
