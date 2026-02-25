/**
 * CastSense Home Screen
 * 
 * Unified form and preview screen where users can:
 * - Choose analysis mode (General/Specific)
 * - Set target species (for Specific mode)
 * - Set optional context (platform, gear, constraints)
 * - Start photo or video capture
 * - Preview selected media
 * - Trigger analysis
 */

import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useApp} from '../state/AppContext';
import {useAppNavigation} from '../navigation/hooks';
import {
  requestCapturePermissions,
  requestLocationPermission,
  requestLibraryPermissions,
} from '../services/permissions';
import {pickMediaFromLibrary, type LibraryMediaResult} from '../services/camera';
import {collectMetadata, extractExifMetadata} from '../services/metadata';
import {analyzeMedia, type UploadProgress} from '../services/api';
import {MediaPreviewSection} from '../components/MediaPreviewSection';
import type {
  AnalysisMode,
  CaptureType,
  PlatformContext,
  GearType,
} from '../state/machine';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ModeButtonProps {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

interface OptionButtonProps {
  title: string;
  selected: boolean;
  onPress: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function ModeButton({title, description, selected, onPress}: ModeButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.modeButton, selected && styles.modeButtonSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.modeButtonTitle, selected && styles.modeButtonTitleSelected]}>
        {title}
      </Text>
      <Text style={[styles.modeButtonDesc, selected && styles.modeButtonDescSelected]}>
        {description}
      </Text>
    </TouchableOpacity>
  );
}

function OptionButton({title, selected, onPress}: OptionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.optionButton, selected && styles.optionButtonSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.optionButtonText, selected && styles.optionButtonTextSelected]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function HomeScreen(): React.JSX.Element {
  const navigation = useAppNavigation();
  const {
    state,
    selectMode,
    setPlatformContext,
    setGearType,
    setUserConstraints,
    startCapture,
    previewReady,
    completeCapture,
    acceptPreview,
    retake,
    updateUploadProgress,
    startAnalysis,
    receiveResults,
    handleError,
  } = useApp();

  // Local form state
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(state.mode);
  const [targetSpecies, setTargetSpecies] = useState<string>(state.targetSpecies || '');
  const [platform, setPlatform] = useState<PlatformContext | null>(state.platformContext);
  const [gear, setGear] = useState<GearType>(state.gearType);
  const [notes, setNotes] = useState<string>(state.userConstraints.notes || '');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Check if we're in preview state
  const hasPreview = state.previewMediaUri !== null && state.previewMediaType !== null;

  // Handle mode selection
  const handleModeSelect = useCallback((mode: AnalysisMode) => {
    setSelectedMode(mode);
    if (mode === 'general') {
      setTargetSpecies('');
    }
  }, []);

  // Start capture flow
  const handleStartCapture = useCallback(async (captureType: CaptureType) => {
    if (!selectedMode) {
      Alert.alert('Select Mode', 'Please select an analysis mode first.');
      return;
    }

    if (selectedMode === 'specific' && !targetSpecies.trim()) {
      Alert.alert('Enter Species', 'Please enter a target species for Specific mode.');
      return;
    }

    // Request permissions
    const permissions = await requestCapturePermissions();
    
    if (!permissions.camera) {
      Alert.alert(
        'Camera Required',
        'Camera permission is required to capture photos and videos.',
      );
      return;
    }

    // Request location separately (optional but recommended)
    if (!permissions.location) {
      await requestLocationPermission();
    }

    // Update app state
    selectMode(selectedMode, selectedMode === 'specific' ? targetSpecies.trim() : undefined);
    
    if (platform) {
      setPlatformContext(platform);
    }
    
    setGearType(gear);
    
    if (notes.trim()) {
      setUserConstraints({ notes: notes.trim() });
    }

    // Start capture
    startCapture(captureType);

    // Navigate to capture screen
    navigation.navigate('Capture', { captureType });
  }, [
    selectedMode,
    targetSpecies,
    platform,
    gear,
    notes,
    selectMode,
    setPlatformContext,
    setGearType,
    setUserConstraints,
    startCapture,
    navigation,
  ]);

  // Handle library selection flow
  const handleSelectFromLibrary = useCallback(async () => {
    if (!selectedMode) {
      Alert.alert('Select Mode', 'Please select an analysis mode first.');
      return;
    }

    if (selectedMode === 'specific' && !targetSpecies.trim()) {
      Alert.alert('Enter Species', 'Please enter a target species for Specific mode.');
      return;
    }

    try {
      setIsProcessing(true);

      // Request library and location permissions
      const permissions = await requestLibraryPermissions();
      
      if (!permissions.mediaLibrary) {
        Alert.alert(
          'Photo Library Required',
          'Photo library permission is required to select existing photos and videos.',
        );
        setIsProcessing(false);
        return;
      }

      // Pick media from library
      const media = await pickMediaFromLibrary();
      
      if (!media) {
        // User canceled selection
        setIsProcessing(false);
        return;
      }

      // Update app state with mode and constraints
      selectMode(selectedMode, selectedMode === 'specific' ? targetSpecies.trim() : undefined);
      
      if (platform) {
        setPlatformContext(platform);
      }
      
      setGearType(gear);
      
      if (notes.trim()) {
        setUserConstraints({ notes: notes.trim() });
      }

      // Start capture state (for preview/analysis flow)
      startCapture(media.type);

      // Update preview state (stays on HomeScreen)
      completeCapture({
        uri: media.uri,
        type: media.type,
        mimeType: media.mimeType,
      });
      previewReady(media.uri, media.type);

    } catch (error) {
      console.error('Library selection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to select media';
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [
    selectedMode,
    targetSpecies,
    platform,
    gear,
    notes,
    selectMode,
    setPlatformContext,
    setGearType,
    setUserConstraints,
    startCapture,
    completeCapture,
    previewReady,
  ]);

  // Handle Analyze button
  const handleAnalyze = useCallback(async () => {
    if (!state.previewMediaUri || !state.previewMediaType) {
      Alert.alert('Error', 'No media selected');
      return;
    }

    try {
      setIsProcessing(true);
      
      // Collect metadata
      const metadata = await collectMetadata({
        mode: state.mode || 'general',
        targetSpecies: state.targetSpecies,
        platformContext: state.platformContext || undefined,
        gearType: state.gearType,
        captureType: state.previewMediaType,
        captureTimestamp: new Date(),
        userConstraints: state.userConstraints,
        includeLocation: true,
      });

      // Determine MIME type based on media type
      const mimeType = state.previewMediaType === 'photo' ? 'image/jpeg' : 'video/mp4';

      // Upload and analyze
      const response = await analyzeMedia(
        { uri: state.previewMediaUri, mimeType },
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
        mediaUri: state.previewMediaUri,
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
      setIsProcessing(false);
    }
  }, [
    state,
    updateUploadProgress,
    acceptPreview,
    startAnalysis,
    handleError,
    navigation,
  ]);

  // Handle Retake button
  const handleRetake = useCallback(() => {
    retake();
  }, [retake]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Analysis Mode</Text>
          <View style={styles.modeContainer}>
            <ModeButton
              title="General"
              description="Identify likely species and get tailored tactics for your spot"
              selected={selectedMode === 'general'}
              onPress={() => handleModeSelect('general')}
            />
            <ModeButton
              title="Specific"
              description="Get tactics optimized for a specific target species"
              selected={selectedMode === 'specific'}
              onPress={() => handleModeSelect('specific')}
            />
          </View>
        </View>

        {/* Target Species (for Specific mode) */}
        {selectedMode === 'specific' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Target Species</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Largemouth Bass, Walleye, Trout"
              value={targetSpecies}
              onChangeText={setTargetSpecies}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
        )}

        {/* Platform Context */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fishing From (Optional)</Text>
          <View style={styles.optionRow}>
            <OptionButton
              title="Shore"
              selected={platform === 'shore'}
              onPress={() => setPlatform(platform === 'shore' ? null : 'shore')}
            />
            <OptionButton
              title="Kayak"
              selected={platform === 'kayak'}
              onPress={() => setPlatform(platform === 'kayak' ? null : 'kayak')}
            />
            <OptionButton
              title="Boat"
              selected={platform === 'boat'}
              onPress={() => setPlatform(platform === 'boat' ? null : 'boat')}
            />
          </View>
        </View>

        {/* Gear Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gear Type (Optional)</Text>
          <View style={styles.optionRow}>
            <OptionButton
              title="Spinning"
              selected={gear === 'spinning'}
              onPress={() => setGear(gear === 'spinning' ? 'unknown' : 'spinning')}
            />
            <OptionButton
              title="Baitcast"
              selected={gear === 'baitcasting'}
              onPress={() => setGear(gear === 'baitcasting' ? 'unknown' : 'baitcasting')}
            />
            <OptionButton
              title="Fly"
              selected={gear === 'fly'}
              onPress={() => setGear(gear === 'fly' ? 'unknown' : 'fly')}
            />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            placeholder="Any additional context..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Media Preview (visible when media selected) */}
        {hasPreview && state.previewMediaUri && state.previewMediaType && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <MediaPreviewSection
              mediaUri={state.previewMediaUri}
              mediaType={state.previewMediaType}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.captureSection}>
          {hasPreview ? (
            <>
              {/* Analyze and Retake buttons when media selected */}
              <TouchableOpacity
                style={[styles.captureButton, styles.libraryButton]}
                onPress={handleRetake}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                <Text style={styles.captureButtonText}>Retake / Choose Different</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.captureButton, styles.photoButton]}
                onPress={handleAnalyze}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.captureButtonText}>Analyze</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Capture buttons when no media selected */}
              <TouchableOpacity
                style={[styles.captureButton, styles.photoButton]}
                onPress={() => handleStartCapture('photo')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <Text style={styles.captureButtonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.captureButton, styles.videoButton]}
                onPress={() => handleStartCapture('video')}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <Text style={styles.captureButtonText}>Record Video</Text>
                <Text style={styles.captureButtonSubtext}>5-10 seconds</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.captureButton, styles.libraryButton]}
                onPress={handleSelectFromLibrary}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <Text style={styles.captureButtonText}>
                  {isProcessing ? 'Processing...' : 'Select from Library'}
                </Text>
                <Text style={styles.captureButtonSubtext}>Choose existing photo or video</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c6c70',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  modeContainer: {
    gap: 12,
  },
  modeButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  modeButtonTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  modeButtonTitleSelected: {
    color: '#007AFF',
  },
  modeButtonDesc: {
    fontSize: 14,
    color: '#6c6c70',
  },
  modeButtonDescSelected: {
    color: '#3d8eff',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#000000',
  },
  notesInput: {
    minHeight: 60,
    paddingTop: 14,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
  },
  optionButtonTextSelected: {
    color: '#007AFF',
  },
  captureSection: {
    marginTop: 8,
    gap: 12,
  },
  captureButton: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  photoButton: {
    backgroundColor: '#007AFF',
  },
  videoButton: {
    backgroundColor: '#FF3B30',
  },
  libraryButton: {
    backgroundColor: '#34C759',
  },
  captureButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  captureButtonSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
});
