/**
 * CastSense Preview Screen
 * 
 * Displays selected photo or video with Analyze and Retake buttons
 * Allows users to review media before starting analysis
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';

import { useApp } from '../state/AppContext';
import { useAppNavigation, usePreviewRoute } from '../navigation/hooks';
import { collectMetadata } from '../services/metadata';
import { analyzeMedia, type UploadProgress } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function PreviewScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const route = usePreviewRoute();
  const { mediaUri, mediaType } = route.params;

  const {
    state,
    acceptPreview,
    retake,
    updateUploadProgress,
    startAnalysis,
    receiveResults,
    handleError,
  } = useApp();

  // Create video player for expo-video
  const player = useVideoPlayer(mediaUri, (player) => {
    player.loop = true;
    player.play();
  });

  const [mediaLoaded, setMediaLoaded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Handle Analyze button
  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      
      // Collect metadata
      const metadata = await collectMetadata({
        mode: state.mode || 'general',
        targetSpecies: state.targetSpecies,
        platformContext: state.platformContext || undefined,
        gearType: state.gearType,
        captureType: mediaType,
        captureTimestamp: new Date(),
        userConstraints: state.userConstraints,
        includeLocation: true,
      });

      // Determine MIME type based on media type
      const mimeType = mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';

      // Upload and analyze
      const response = await analyzeMedia(
        { uri: mediaUri, mimeType },
        metadata,
        (progress: UploadProgress) => {
          updateUploadProgress(progress.percentage);
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Analysis failed');
      }

      // Transition to Uploading state
      acceptPreview();

      startAnalysis();

      // Navigate to results
      navigation.replace('Results', {
        result: {
          request_id: response.data.request_id,
          status: response.data.status,
          rendering_mode: response.data.rendering_mode,
          result: response.data.result,
          context_pack: response.data.context_pack,
          timings_ms: response.data.timings_ms,
          enrichment_status: response.data.enrichment_status,
        },
        mediaUri: mediaUri,
      });

    } catch (error) {
      console.error('Upload/analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      handleError({
        code: 'UPLOAD_FAILED',
        message: errorMessage,
        retryable: true,
      });

      navigation.navigate('Error', {
        error: {
          code: 'UPLOAD_FAILED',
          message: errorMessage,
          retryable: true,
        },
        canRetry: true,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Retake button
  const handleRetake = () => {
    // Transition back to ModeSelected state
    retake();
  };

  const isPhoto = mediaType === 'photo';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Media Display */}
      <View style={styles.mediaContainer}>
        {isPhoto ? (
          <Image
            source={{ uri: mediaUri }}
            style={styles.media}
            onLoadEnd={() => setMediaLoaded(true)}
          />
        ) : (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="contain"
            allowsFullscreen
            nativeControls
          />
        )}

        {!mediaLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
      </View>

      {/* Button Container */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.retakeButton]}
          onPress={handleRetake}
          disabled={isAnalyzing}
          activeOpacity={0.8}
        >
          <Text style={styles.retakeButtonText}>Retake / Choose Different</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.analyzeButton]}
          onPress={handleAnalyze}
          disabled={isAnalyzing}
          activeOpacity={0.8}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.analyzeButtonText}>Analyze</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
  },
  analyzeButton: {
    backgroundColor: '#007AFF',
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retakeButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  retakeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
