/**
 * Media Preview Section Component
 * 
 * Displays photo or video preview within a scrollable form.
 * Used in the unified HomeScreen after media selection.
 */

import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import type { CaptureType } from '../state/machine';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MediaPreviewSectionProps {
  mediaUri: string;
  mediaType: CaptureType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MediaPreviewSection({
  mediaUri,
  mediaType,
}: MediaPreviewSectionProps): React.JSX.Element {
  // Create video player for expo-video
  const player = useVideoPlayer(mediaUri, (player) => {
    player.loop = true;
    player.play();
  });

  const [mediaLoaded, setMediaLoaded] = useState(true);

  const isPhoto = mediaType === 'photo';

  return (
    <View style={styles.container}>
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 300,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  media: {
    width: '100%',
    height: '100%',
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
});
