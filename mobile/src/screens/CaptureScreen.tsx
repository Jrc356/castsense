/**
 * CastSense Capture Screen
 * 
 * Full-screen camera interface for capturing photos.
 * Features:
 * - Photo capture with local processing
 * - Analysis progress indication
 * - Error handling
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type CameraPosition,
} from 'react-native-vision-camera';

import {useApp} from '../state/AppContext';
import {useAppNavigation} from '../navigation/hooks';
import {capturePhoto, type CameraRef, type PhotoCapture} from '../services/camera';
import {hasApiKey, getApiKey} from '../services/api-key-storage';
import {runAnalysis} from '../services/analysis-orchestrator';
import {getCurrentLocation} from '../services/metadata';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function CaptureScreen(): React.JSX.Element {
  const navigation = useAppNavigation();

  const {
    state,
    updateProcessingProgress,
    updateEnrichmentProgress,
    updateAIProgress,
    receiveResults,
    handleError,
    reset,
  } = useApp();

  // Camera state
  const cameraRef = useRef<Camera>(null);
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');
  const device = useCameraDevice(cameraPosition);
  const {hasPermission} = useCameraPermission();

  // Capture state
  const [isCapturing, setIsCapturing] = useState(false);

  // Handle photo capture
  const handlePhotoCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      // Check for API key before capture
      const hasKey = await hasApiKey();
      if (!hasKey) {
        Alert.alert(
          'API Key Required',
          'Please set your OpenAI API key in Settings before capturing.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Go to Settings',
              onPress: () => navigation.navigate('Settings'),
            },
          ]
        );
        return;
      }

      setIsCapturing(true);

      // Capture photo
      const photo = await capturePhoto(cameraRef.current as unknown as CameraRef);
      
      // Get location
      const location = await getCurrentLocation();
      
      if (!location) {
        throw new Error('Unable to get location. Please ensure GPS is enabled.');
      }

      // Get API key
      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error('No API key configured');
      }

      const result = await runAnalysis({
        photoUri: photo.uri,
        location,
        options: {mode: state.mode || 'general'},
        apiKey,
        onProgress: (progress) => {
          if (progress.stage === 'processing') {
            updateProcessingProgress(progress.progress);
          } else if (progress.stage === 'enriching') {
            updateEnrichmentProgress(progress.progress);
          } else if (progress.stage === 'analyzing') {
            updateAIProgress(progress.progress);
          }
        },
      });

      if (result.success && result.data) {
        receiveResults(result.data);
        navigation.navigate('Results', {
          result: result.data,
          mediaUri: photo.uri,
        });
      } else {
        handleError(result.error || {
          code: 'UNKNOWN_ERROR',
          message: 'Analysis failed',
          retryable: true,
        });
        navigation.navigate('Error', {
          error: result.error || {
            code: 'UNKNOWN_ERROR',
            message: 'Analysis failed',
            retryable: true,
          },
          canRetry: true,
        });
      }

    } catch (error) {
      console.error('Photo capture error:', error);
      const appError = {
        code: 'CAPTURE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to capture photo. Please try again.',
        retryable: true,
      };
      handleError(appError);
      navigation.navigate('Error', {
        error: appError,
        canRetry: true,
      });
    } finally {
      setIsCapturing(false);
    }
  }, [
    isCapturing,
    state.mode,
    navigation,
    updateProcessingProgress,
    updateEnrichmentProgress,
    updateAIProgress,
    receiveResults,
    handleError,
  ]);

  // Handle back/cancel
  const handleCancel = useCallback(() => {
    reset();
    navigation.goBack();
  }, [reset, navigation]);

  // Handle camera flip
  const handleFlipCamera = useCallback(() => {
    setCameraPosition((pos: CameraPosition) => pos === 'back' ? 'front' : 'back');
  }, []);

  // Render loading state
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Camera permission required</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Loading camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Determine processing status
  const isAnalyzing = state.state === 'Processing' || state.state === 'Enriching' || state.state === 'Analyzing';
  const progressPercent = 
    state.state === 'Processing' ? state.processingProgress :
    state.state === 'Enriching' ? state.enrichmentProgress :
    state.state === 'Analyzing' ? state.aiProgress : 0;
  const statusMessage =
    state.state === 'Processing' ? 'Processing image...' :
    state.state === 'Enriching' ? 'Gathering context...' :
    state.state === 'Analyzing' ? 'Analyzing with AI...' :
    isCapturing ? 'Capturing...' : '';

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={!isAnalyzing}
        photo={true}
      />

      {/* Processing overlay */}
      {isAnalyzing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.processingText}>{statusMessage}</Text>
          {progressPercent > 0 && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: `${progressPercent}%`}]} />
            </View>
          )}
        </View>
      )}

      {/* Top controls */}
      <SafeAreaView style={styles.topControls} edges={['top']}>
        <TouchableOpacity 
          style={styles.topButton} 
          onPress={handleCancel}
          disabled={isCapturing || isAnalyzing}
        >
          <Text style={styles.topButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.topButton} 
          onPress={handleFlipCamera}
          disabled={isCapturing || isAnalyzing}
        >
          <Text style={styles.topButtonText}>Flip</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom controls */}
      {!isAnalyzing && (
        <SafeAreaView style={styles.bottomControls} edges={['bottom']}>
          <TouchableOpacity
            style={[styles.captureButton, styles.photoButton]}
            onPress={handlePhotoCapture}
            disabled={isCapturing}
            activeOpacity={0.7}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <Text style={styles.hintText}>Tap to capture photo</Text>
        </SafeAreaView>
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
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 12,
  },
  cancelButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  topButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  topButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 32,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoButton: {},
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
  },
  hintText: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.8,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  processingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
});
