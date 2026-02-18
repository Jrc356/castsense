/**
 * NetworkErrorView Component
 * 
 * Handles network failures (no connectivity, timeout)
 * Shows offline indicator and monitors network state
 * Auto-enables retry when network is restored
 */

import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import {useNetworkStatus} from '../../hooks/useNetworkStatus';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NetworkErrorViewProps {
  /** Error message to display */
  message?: string;
  /** Whether this was a timeout error vs complete offline */
  isTimeout?: boolean;
  /** Callback when user wants to retry */
  onRetry: () => void;
  /** Callback when user wants to start over */
  onStartOver: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function NetworkErrorView({
  message = 'Unable to reach the server. Check your internet connection.',
  isTimeout = false,
  onRetry,
  onStartOver,
}: NetworkErrorViewProps): React.JSX.Element {
  const [networkRestored, setNetworkRestored] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Monitor network status
  const {isConnected, isInternetReachable, connectionType} = useNetworkStatus({
    onNetworkRestored: () => {
      setNetworkRestored(true);
    },
  });

  // Determine if we're currently online
  const isOnline = isConnected && isInternetReachable !== false;

  // Animate pulse when offline
  useEffect(() => {
    if (!isOnline) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
    pulseAnim.setValue(1);
    return undefined;
  }, [isOnline, pulseAnim]);

  // Handle retry
  const handleRetry = useCallback(() => {
    onRetry();
  }, [onRetry]);

  // Format connection type for display
  const getConnectionTypeLabel = (): string => {
    switch (connectionType) {
      case 'wifi':
        return 'WiFi';
      case 'cellular':
        return 'Cellular';
      case 'ethernet':
        return 'Ethernet';
      case 'none':
        return 'No Connection';
      default:
        return connectionType || 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      {/* Animated offline indicator */}
      <Animated.View style={[styles.iconContainer, {opacity: pulseAnim}]}>
        <Text style={styles.icon}>{isOnline ? '✓' : '📶'}</Text>
      </Animated.View>

      {/* Title */}
      <Text style={styles.title}>
        {isTimeout ? 'Connection Timeout' : 'No Connection'}
      </Text>

      {/* Network status indicator */}
      <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
        <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
        <Text style={[styles.statusText, isOnline ? styles.onlineText : styles.offlineText]}>
          {isOnline ? 'Connected' : 'Offline'} • {getConnectionTypeLabel()}
        </Text>
      </View>

      {/* Message */}
      <Text style={styles.message}>{message}</Text>

      {/* Network restored notification */}
      {networkRestored && isOnline && (
        <View style={styles.restoredContainer}>
          <Text style={styles.restoredIcon}>🎉</Text>
          <Text style={styles.restoredText}>Network connection restored!</Text>
        </View>
      )}

      {/* Tips */}
      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>Troubleshooting:</Text>
        <Text style={styles.tipText}>• Check WiFi or cellular data is enabled</Text>
        <Text style={styles.tipText}>• Move to an area with better signal</Text>
        <Text style={styles.tipText}>• Try toggling Airplane Mode</Text>
        {isTimeout && (
          <Text style={styles.tipText}>• The server may be temporarily busy</Text>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            !isOnline && styles.disabledButton,
          ]}
          onPress={handleRetry}
          disabled={!isOnline}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.primaryButtonText,
            !isOnline && styles.disabledButtonText,
          ]}>
            {isOnline ? 'Retry' : 'Waiting for Connection...'}
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
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  onlineBadge: {
    backgroundColor: '#E8F5E9',
  },
  offlineBadge: {
    backgroundColor: '#FFEBEE',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  onlineDot: {
    backgroundColor: '#4CAF50',
  },
  offlineDot: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  onlineText: {
    color: '#2E7D32',
  },
  offlineText: {
    color: '#C62828',
  },
  message: {
    fontSize: 16,
    color: '#3c3c43',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  restoredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  restoredIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  restoredText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  tips: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 32,
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

export default NetworkErrorView;
