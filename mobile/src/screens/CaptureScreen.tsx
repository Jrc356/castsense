/**
 * CastSense Capture Screen
 * 
 * Full-screen camera interface for capturing photos and videos.
 * Features:
 * - Photo capture with preview
 * - Video recording with timer and auto-stop at 10s
 * - Upload progress indication
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
import {
  useAppNavigation,
  useCaptureRoute,
} from '../navigation/hooks';
import {
  capturePhoto,
  startVideoCapture,
  stopVideoCapture,
  formatDuration,
  getMaxVideoDuration,
  type CameraRef,
  type PhotoCapture,
  type VideoCapture,
} from '../services/camera';
import {collectMetadata} from '../services/metadata';
import {analyzeMedia, type UploadProgress} from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const MAX_VIDEO_DURATION_MS = getMaxVideoDuration();

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function CaptureScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const route = useCaptureRoute();
  const {captureType} = route.params;

  const {
    state,
    completeCapture,
    previewReady,
    updateUploadProgress,
    startAnalysis,
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

  // Handle photo capture
  const handlePhotoCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      setStatusText('Capturing...');

      const photo = await capturePhoto(cameraRef.current as unknown as CameraRef);
      
      completeCapture({
        uri: photo.uri,
        type: 'photo',
        width: photo.width,
        height: photo.height,
        mimeType: photo.mimeType,
      });

      // Navigate to preview
      previewReady(photo.uri, 'photo');
      navigation.navigate('Preview', {
        mediaUri: photo.uri,
        mediaType: 'photo',
      });

    } catch (error) {
      console.error('Photo capture error:', error);
      handleError({
        code: 'CAPTURE_FAILED',
        message: 'Failed to capture photo. Please try again.',
        retryable: true,
      });
      navigation.navigate('Error', {
        error: {
          code: 'CAPTURE_FAILED',
          message: 'Failed to capture photo. Please try again.',
          retryable: true,
        },
        canRetry: true,
      });
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, completeCapture, previewReady, handleError, navigation]);

  // Handle video recording toggle
  const handleVideoToggle = useCallback(async () => {
    if (!cameraRef.current) return;

    if (isRecording) {
      // Stop recording
      try {
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
          recordingTimer.current = null;
        }
        setIsRecording(false);
        setStatusText('Processing video...');
        setIsCapturing(true);

        const video = await stopVideoCapture(cameraRef.current as unknown as CameraRef);
        
        completeCapture({
          uri: video.uri,
          type: 'video',
          durationMs: video.durationMs,
          sizeBytes: video.sizeBytes,
          mimeType: video.mimeType,
        });

        // Navigate to preview
        previewReady(video.uri, 'video');
        navigation.navigate('Preview', {
          mediaUri: video.uri,
          mediaType: 'video',
        });

      } catch (error) {
        console.error('Video stop error:', error);
        setIsCapturing(false);
        handleError({
          code: 'CAPTURE_FAILED',
          message: 'Failed to save video. Please try again.',
          retryable: true,
        });
      }
    } else {
      // Start recording
      try {
        setIsRecording(true);
        setRecordingDuration(0);

        await startVideoCapture(cameraRef.current as unknown as CameraRef);

        // Start timer
        const startTime = Date.now();
        recordingTimer.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          setRecordingDuration(elapsed);

          // Auto-stop at max duration
          if (elapsed >= MAX_VIDEO_DURATION_MS) {
            handleVideoToggle();
          }
        }, 100);

      } catch (error) {
        console.error('Video start error:', error);
        setIsRecording(false);
        Alert.alert('Error', 'Failed to start recording. Please try again.');
      }
    }
  }, [isRecording, completeCapture, previewReady, handleError, navigation]);

  // Handle back/cancel
  const handleCancel = useCallback(() => {
    if (isRecording) {
      // Stop recording first
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      setIsRecording(false);
    }
    reset();
    navigation.goBack();
  }, [isRecording, reset, navigation]);

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

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={!isProcessing}
        photo={captureType === 'photo'}
        video={captureType === 'video'}
        audio={captureType === 'video'}
      />

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingTime}>
            {formatDuration(recordingDuration)}
          </Text>
          <Text style={styles.recordingMax}>
            / {formatDuration(MAX_VIDEO_DURATION_MS)}
          </Text>
        </View>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.processingText}>{statusText}</Text>
          {uploadProgress > 0 && uploadProgress < 100 && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: `${uploadProgress}%`}]} />
            </View>
          )}
        </View>
      )}

      {/* Top controls */}
      <SafeAreaView style={styles.topControls} edges={['top']}>
        <TouchableOpacity 
          style={styles.topButton} 
          onPress={handleCancel}
          disabled={isCapturing}
        >
          <Text style={styles.topButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.topButton} 
          onPress={handleFlipCamera}
          disabled={isCapturing || isRecording}
        >
          <Text style={styles.topButtonText}>Flip</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom controls */}
      {!isProcessing && (
        <SafeAreaView style={styles.bottomControls} edges={['bottom']}>
          {/* Capture button */}
          {captureType === 'photo' ? (
            <TouchableOpacity
              style={[styles.captureButton, styles.photoButton]}
              onPress={handlePhotoCapture}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.captureButton, 
                styles.videoButton,
                isRecording && styles.videoButtonRecording,
              ]}
              onPress={handleVideoToggle}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              <View style={[
                styles.captureButtonInner,
                isRecording && styles.videoButtonInnerRecording,
              ]} />
            </TouchableOpacity>
          )}

          {/* Hint text */}
          <Text style={styles.hintText}>
            {captureType === 'photo' 
              ? 'Tap to capture photo'
              : isRecording 
                ? 'Tap to stop recording'
                : 'Tap to start recording'}
          </Text>
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
  videoButton: {
    borderColor: '#FF3B30',
  },
  videoButtonRecording: {
    borderColor: '#FF3B30',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
  },
  videoButtonInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  hintText: {
    color: '#ffffff',
    fontSize: 14,
    opacity: 0.8,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingTime: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  recordingMax: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginLeft: 4,
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
