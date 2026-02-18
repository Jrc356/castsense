/**
 * RateLimitView Component
 * 
 * Handles rate limiting errors (RATE_LIMITED / 429)
 * Shows cooldown timer and retry button
 */

import React, {useCallback, useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitViewProps {
  /** Error message to display */
  message?: string;
  /** Retry-after time in seconds (from server header) */
  retryAfterSeconds?: number;
  /** Callback when user wants to retry */
  onRetry: () => void;
  /** Callback when user wants to start over */
  onStartOver: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COOLDOWN_SECONDS = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function RateLimitView({
  message = 'You\'ve made too many requests. Please wait a moment before trying again.',
  retryAfterSeconds = DEFAULT_COOLDOWN_SECONDS,
  onRetry,
  onStartOver,
}: RateLimitViewProps): React.JSX.Element {
  const [countdown, setCountdown] = useState(retryAfterSeconds);
  const [canRetry, setCanRetry] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setCanRetry(true);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanRetry(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Format countdown display
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  // Calculate progress for visual indicator
  const progress = Math.max(0, 1 - (countdown / retryAfterSeconds));

  // Handle retry
  const handleRetry = useCallback(() => {
    onRetry();
  }, [onRetry]);

  return (
    <View style={styles.container}>
      {/* Icon */}
      <Text style={styles.icon}>🚫</Text>

      {/* Title */}
      <Text style={styles.title}>Too Many Requests</Text>

      {/* Error code badge */}
      <View style={styles.codeBadge}>
        <Text style={styles.codeText}>RATE_LIMITED</Text>
      </View>

      {/* Message */}
      <Text style={styles.message}>{message}</Text>

      {/* Countdown display */}
      {!canRetry && (
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>Please wait</Text>
          
          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
          
          <Text style={styles.countdownTime}>{formatCountdown(countdown)}</Text>
        </View>
      )}

      {/* Ready to retry */}
      {canRetry && (
        <View style={styles.readyContainer}>
          <Text style={styles.readyIcon}>✓</Text>
          <Text style={styles.readyText}>You can try again now</Text>
        </View>
      )}

      {/* Info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Why am I seeing this?</Text>
        <Text style={styles.infoText}>
          Rate limits help ensure the service remains available for everyone. 
          Each user is limited to a certain number of analyses per minute.
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            !canRetry && styles.disabledButton,
          ]}
          onPress={handleRetry}
          disabled={!canRetry}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.primaryButtonText,
            !canRetry && styles.disabledButtonText,
          ]}>
            {canRetry ? 'Retry' : `Wait ${formatCountdown(countdown)}`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onStartOver}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Start Over</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  countdownContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 24,
  },
  countdownLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  countdownTime: {
    fontSize: 36,
    fontWeight: '700',
    color: '#007AFF',
    fontVariant: ['tabular-nums'],
  },
  readyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  readyIcon: {
    fontSize: 24,
    color: '#4CAF50',
    marginRight: 12,
  },
  readyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  infoBox: {
    backgroundColor: '#F0F0F5',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#3c3c43',
    lineHeight: 20,
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
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  disabledButtonText: {
    color: '#8E8E93',
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

export default RateLimitView;
