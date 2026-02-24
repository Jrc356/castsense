/**
 * CastSense Error Screen
 * 
 * Routes to appropriate error view based on error type:
 * - NO_GPS → LocationErrorView
 * - NO_NETWORK / timeout → NetworkErrorView
 * - AI_TIMEOUT, ENRICHMENT_FAILED, UNKNOWN → ServerErrorView
 * - INVALID_MEDIA → MediaErrorView
 * - RATE_LIMITED → RateLimitView
 */

import React, {useCallback, useMemo} from 'react';
import {StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAppNavigation, useErrorRoute} from '../navigation/hooks';
import {useApp} from '../state/AppContext';
import {
  LocationErrorView,
  NetworkErrorView,
  ServerErrorView,
  MediaErrorView,
  RateLimitView,
  getErrorType,
  type ErrorType,
  type ServerErrorCode,
} from '../components/errors';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function ErrorScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const route = useErrorRoute();
  const {retry, reset, state} = useApp();

  const {error, canRetry} = route.params;
  
  // Determine error type for routing
  const errorType: ErrorType = useMemo(() => {
    return getErrorType(error.code);
  }, [error.code]);

  // Handle retry - go back to uploading/analyzing state
  const handleRetry = useCallback(() => {
    retry();
    navigation.goBack();
  }, [retry, navigation]);

  // Handle start over - reset to home
  const handleStartOver = useCallback(() => {
    reset();
    navigation.popToTop();
  }, [reset, navigation]);

  // Handle recapture - go back to capture mode
  const handleRecapture = useCallback(() => {
    // Reset state but stay in mode selected state for recapture
    reset();
    navigation.popToTop();
    // Note: The user will need to initiate capture again from home
  }, [reset, navigation]);

  // Handle view fallback results (for ENRICHMENT_FAILED)
  const handleViewFallback = useCallback(() => {
    // If we have partial results, navigate to results
    // The state machine should still have the results
    if (state.analysisResult) {
      navigation.navigate('Results', {
        result: state.analysisResult,
        mediaUri: state.captureResult?.uri || '',
      });
    } else {
      // Fallback to retry if no results
      handleRetry();
    }
  }, [state.analysisResult, state.captureResult, navigation, handleRetry]);

  // Render appropriate error view based on error type
  const renderErrorView = (): React.JSX.Element => {
    switch (errorType) {
      case 'location':
        return (
          <LocationErrorView
            message={error.message}
            onRetry={handleRetry}
            onStartOver={handleStartOver}
          />
        );

      case 'network':
        return (
          <NetworkErrorView
            message={error.message}
            isTimeout={error.code === 'TIMEOUT' || error.code === 'UPLOAD_FAILED'}
            onRetry={handleRetry}
            onStartOver={handleStartOver}
          />
        );

      case 'server':
        return (
          <ServerErrorView
            errorCode={(error.code as ServerErrorCode) || 'UNKNOWN'}
            message={error.message}
            retryable={canRetry && error.retryable}
            details={error.details}
            onRetry={handleRetry}
            onViewFallback={
              error.code === 'ENRICHMENT_FAILED' ? handleViewFallback : undefined
            }
            onStartOver={handleStartOver}
          />
        );

      case 'media':
        return (
          <MediaErrorView
            message={error.message}
            validationIssue={
              error.details?.validationIssue as string | undefined
            }
            details={error.details}
            onRecapture={handleRecapture}
            onStartOver={handleStartOver}
          />
        );

      case 'rate_limit':
        return (
          <RateLimitView
            message={error.message}
            retryAfterSeconds={
              (error.details?.retryAfter as number | undefined) || 60
            }
            onRetry={handleRetry}
            onStartOver={handleStartOver}
          />
        );

      default:
        // Fallback to server error view for unknown error types
        return (
          <ServerErrorView
            errorCode="UNKNOWN"
            message={error.message}
            retryable={canRetry && error.retryable}
            details={error.details}
            onRetry={handleRetry}
            onStartOver={handleStartOver}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderErrorView()}
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
});
