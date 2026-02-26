/**
 * CastSense Capture Screen
 * 
 * Full-screen camera interface for capturing photos or selecting from gallery.
 * Features:
 * - Photo capture with local processing
 * - Gallery selection from media library
 * - Analysis progress indication
 * - Error handling
 */

import React, {useCallback, useRef, useState} from 'react';
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
import {capturePhoto, pickMediaFromLibrary, type CameraRef} from '../services/camera';
import {hasApiKey} from '../services/api-key-storage';
import {requestPermission} from '../services/permissions';

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
    completeCapture,
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
  const [isSelectingLibrary, setIsSelectingLibrary] = useState(false);

  // Handle photo capture
  const handlePhotoCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing || isSelectingLibrary) return;

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
      
      // Store capture result and navigate back to HomeScreen
      completeCapture({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        sizeBytes: photo.sizeBytes,
        mimeType: photo.mimeType || 'image/jpeg',
      });
      
      navigation.navigate('Home');

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
  }, [isCapturing, isSelectingLibrary, completeCapture, navigation, handleError]);

  // Handle gallery selection
  const handleGallerySelect = useCallback(async () => {
    if (isSelectingLibrary || isCapturing) return;

    try {
      // Check for API key before selecting
      const hasKey = await hasApiKey();
      if (!hasKey) {
        Alert.alert(
          'API Key Required',
          'Please set your OpenAI API key in Settings before selecting a photo.',
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

      // Request media library permission
      const permStatus = await requestPermission('mediaLibrary');
      if (permStatus !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Media library access is required to select photos.'
        );
        return;
      }

      setIsSelectingLibrary(true);

      // Pick photo from library
      const libraryPhoto = await pickMediaFromLibrary();
      
      if (!libraryPhoto) {
        // User cancelled selection
        return;
      }

      // Store capture result and navigate back to HomeScreen
      completeCapture({
        uri: libraryPhoto.uri,
        width: libraryPhoto.width,
        height: libraryPhoto.height,
        sizeBytes: libraryPhoto.sizeBytes,
        mimeType: libraryPhoto.mimeType || 'image/jpeg',
      });
      
      navigation.navigate('Home');

    } catch (error) {
      console.error('Gallery selection error:', error);
      const appError = {
        code: 'LIBRARY_SELECT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to select photo. Please try again.',
        retryable: true,
      };
      handleError(appError);
      navigation.navigate('Error', {
        error: appError,
        canRetry: true,
      });
    } finally {
      setIsSelectingLibrary(false);
    }
  }, [isSelectingLibrary, isCapturing, completeCapture, navigation, handleError]);

  // Handle back/cancel
  const handleCancel = useCallback(() => {
    reset();
    navigation.goBack();
  }, [reset, navigation]);

  // Handle camera flip
  const handleFlipCamera = useCallback(() => {
    setCameraPosition((pos: CameraPosition) => pos === 'back' ? 'front' : 'back');
  }, []);

  // Render permission error
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

  // Render loading state
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

  // Determine status
  const statusMessage =
    isCapturing ? 'Capturing...' :
    isSelectingLibrary ? 'Selecting photo...' : '';

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={true}
        photo={true}
      />

      {/* Status overlay */}
      {statusMessage && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.processingText}>{statusMessage}</Text>
        </View>
      )}

      {/* Top controls */}
      <SafeAreaView style={styles.topControls} edges={['top']}>
        <TouchableOpacity 
          style={styles.topButton} 
          onPress={handleCancel}
          disabled={isCapturing || isSelectingLibrary}
        >
          <Text style={styles.topButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.topButton} 
          onPress={handleFlipCamera}
          disabled={isCapturing || isSelectingLibrary}
        >
          <Text style={styles.topButtonText}>Flip</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom controls */}
      {!statusMessage && (
        <SafeAreaView style={styles.bottomControls} edges={['bottom']}>
          <TouchableOpacity
            style={[styles.captureButton, styles.galleryButton]}
            onPress={handleGallerySelect}
            disabled={isCapturing || isSelectingLibrary}
            activeOpacity={0.7}
          >
            <Text style={styles.galleryButtonText}>📷</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureButton, styles.photoButton]}
            onPress={handlePhotoCapture}
            disabled={isCapturing || isSelectingLibrary}
            activeOpacity={0.7}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <Text style={styles.hintText}>Capture or select photo</Text>
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
    paddingVertical: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoButton: {
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#ffffff',
    marginTop: 12,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  galleryButton: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  galleryButtonText: {
    fontSize: 28,
  },
  hintText: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 12,
    textAlign: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
});
