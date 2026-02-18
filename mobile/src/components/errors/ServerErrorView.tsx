/**
 * ServerErrorView Component
 * 
 * Handles server errors including:
 * - AI_TIMEOUT
 * - ENRICHMENT_FAILED
 * - UNKNOWN server errors
 * 
 * Shows friendly message, error code reference, and retry options
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

export type ServerErrorCode = 
  | 'AI_TIMEOUT'
  | 'ENRICHMENT_FAILED'
  | 'UNKNOWN';

export interface ServerErrorViewProps {
  /** The specific error code */
  errorCode: ServerErrorCode;
  /** Error message from backend */
  message?: string;
  /** Whether the error is retryable */
  retryable?: boolean;
  /** Error details for debugging */
  details?: Record<string, unknown>;
  /** Text-only fallback result if available */
  textOnlyFallback?: string;
  /** Callback when user wants to retry */
  onRetry: () => void;
  /** Callback when user wants to view fallback results */
  onViewFallback?: () => void;
  /** Callback when user wants to start over */
  onStartOver: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface ErrorConfig {
  title: string;
  message: string;
  icon: string;
  tips: string[];
}

const ERROR_CONFIG: Record<ServerErrorCode, ErrorConfig> = {
  AI_TIMEOUT: {
    title: 'Analysis Timeout',
    message: 'The AI analysis is taking longer than expected. This can happen during busy periods or with complex scenes.',
    icon: '⏱️',
    tips: [
      'Try again - the server may be less busy now',
      'Use a simpler scene with clearer water features',
      'Ensure good lighting in your photo/video',
      'Try a shorter video clip',
    ],
  },
  ENRICHMENT_FAILED: {
    title: 'Partial Data Available',
    message: 'We analyzed your scene but couldn\'t retrieve all environmental data. Weather, tide, or solar information may be missing.',
    icon: '🌤️',
    tips: [
      'Results are still available with limited context',
      'Check your location settings are accurate',
      'Environmental services may be temporarily unavailable',
    ],
  },
  UNKNOWN: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred while processing your request.',
    icon: '❌',
    tips: [
      'Try again in a few moments',
      'Check your internet connection',
      'If the problem persists, try starting over',
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ServerErrorView({
  errorCode,
  message,
  retryable = true,
  details,
  textOnlyFallback,
  onRetry,
  onViewFallback,
  onStartOver,
}: ServerErrorViewProps): React.JSX.Element {
  const config = ERROR_CONFIG[errorCode] || ERROR_CONFIG.UNKNOWN;
  const displayMessage = message || config.message;

  // Handle view fallback results
  const handleViewFallback = useCallback(() => {
    onViewFallback?.();
  }, [onViewFallback]);

  // Handle retry
  const handleRetry = useCallback(() => {
    onRetry();
  }, [onRetry]);

  // Determine if we should show the fallback option
  const hasFallback = textOnlyFallback || errorCode === 'ENRICHMENT_FAILED';

  return (
    <ScrollView 
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Icon */}
      <Text style={styles.icon}>{config.icon}</Text>

      {/* Title */}
      <Text style={styles.title}>{config.title}</Text>

      {/* Error code badge */}
      <View style={styles.codeBadge}>
        <Text style={styles.codeText}>{errorCode}</Text>
      </View>

      {/* Message */}
      <Text style={styles.message}>{displayMessage}</Text>

      {/* Fallback available notice */}
      {hasFallback && (
        <View style={styles.fallbackNotice}>
          <Text style={styles.fallbackIcon}>💡</Text>
          <Text style={styles.fallbackText}>
            {errorCode === 'ENRICHMENT_FAILED' 
              ? 'Analysis results are available with limited environmental data.'
              : 'Text-only results are available as a fallback.'}
          </Text>
        </View>
      )}

      {/* Tips */}
      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>What you can try:</Text>
        {config.tips.map((tip, index) => (
          <Text key={index} style={styles.tipText}>• {tip}</Text>
        ))}
      </View>

      {/* Debug details (collapsed by default, shown for development) */}
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
        {/* View fallback button */}
        {hasFallback && onViewFallback && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleViewFallback}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>View Results</Text>
          </TouchableOpacity>
        )}

        {/* Retry button */}
        {retryable && (
          <TouchableOpacity
            style={[
              styles.button,
              hasFallback ? styles.secondaryButton : styles.primaryButton,
            ]}
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Text style={hasFallback ? styles.secondaryButtonText : styles.primaryButtonText}>
              Retry
            </Text>
          </TouchableOpacity>
        )}

        {/* Start over button */}
        <TouchableOpacity
          style={[styles.button, styles.tertiaryButton]}
          onPress={onStartOver}
          activeOpacity={0.8}
        >
          <Text style={styles.tertiaryButtonText}>Start Over</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  codeBadge: {
    backgroundColor: '#FF9500',
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
  fallbackNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  fallbackIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  fallbackText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
  },
  tips: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#3c3c43',
    lineHeight: 22,
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  tertiaryButton: {
    backgroundColor: '#e5e5ea',
  },
  tertiaryButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default ServerErrorView;
