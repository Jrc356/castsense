/**
 * LocationErrorView Component
 * 
 * Specialized view for GPS/location permission errors
 * Shows step-by-step instructions for enabling location
 * Platform-specific guidance (iOS vs Android)
 */

import React, {useCallback, useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import {openSettings} from 'react-native-permissions';
import {
  requestLocationPermission,
  isPermissionGranted,
} from '../../services/permissions';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LocationErrorViewProps {
  /** Error message to display */
  message?: string;
  /** Callback when user wants to retry after granting permission */
  onRetry: () => void;
  /** Callback when user wants to start over */
  onStartOver: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_INSTRUCTIONS = {
  ios: [
    'Open Settings',
    'Scroll down and tap "CastSense"',
    'Tap "Location"',
    'Select "While Using the App"',
  ],
  android: [
    'Open Settings',
    'Tap "Apps" or "Application Manager"',
    'Find and tap "CastSense"',
    'Tap "Permissions" → "Location"',
    'Select "Allow only while using the app"',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function LocationErrorView({
  message = 'CastSense needs your location to analyze fishing conditions and provide weather data, tide information, and local insights.',
  onRetry,
  onStartOver,
}: LocationErrorViewProps): React.JSX.Element {
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const instructions = Platform.select({
    ios: PLATFORM_INSTRUCTIONS.ios,
    android: PLATFORM_INSTRUCTIONS.android,
    default: PLATFORM_INSTRUCTIONS.android,
  });

  // Check permission status periodically when user might be in settings
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkPermission = async () => {
      const granted = await isPermissionGranted('location');
      if (granted) {
        setPermissionGranted(true);
        if (intervalId) {
          clearInterval(intervalId);
        }
      }
    };

    // Check every 2 seconds when component is mounted
    intervalId = setInterval(checkPermission, 2000);

    // Initial check
    checkPermission();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Handle opening settings
  const handleOpenSettings = useCallback(async () => {
    try {
      await openSettings();
    } catch {
      // Fallback to system settings
      Linking.openSettings();
    }
  }, []);

  // Handle try again (re-request permission)
  const handleTryAgain = useCallback(async () => {
    setIsCheckingPermission(true);
    try {
      const granted = await requestLocationPermission();
      setPermissionGranted(granted);
      if (granted) {
        onRetry();
      }
    } finally {
      setIsCheckingPermission(false);
    }
  }, [onRetry]);

  // Handle retry after permission granted
  const handleRetryWithPermission = useCallback(() => {
    onRetry();
  }, [onRetry]);

  return (
    <View style={styles.container}>
      {/* Icon */}
      <Text style={styles.icon}>📍</Text>

      {/* Title */}
      <Text style={styles.title}>Location Required</Text>

      {/* Message */}
      <Text style={styles.message}>{message}</Text>

      {/* Permission granted state */}
      {permissionGranted ? (
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>Location permission granted!</Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleRetryWithPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue Analysis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>
              How to enable location {Platform.OS === 'ios' ? '(iOS)' : '(Android)'}:
            </Text>
            {instructions.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleOpenSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Open Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleTryAgain}
              disabled={isCheckingPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>
                {isCheckingPermission ? 'Checking...' : 'Try Again'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.tertiaryButton]}
              onPress={onStartOver}
              activeOpacity={0.8}
            >
              <Text style={styles.tertiaryButtonText}>Start Over</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
  message: {
    fontSize: 16,
    color: '#3c3c43',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  instructionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 32,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    width: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#3c3c43',
    lineHeight: 20,
  },
  successContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 48,
    color: '#4CAF50',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 16,
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

export default LocationErrorView;
