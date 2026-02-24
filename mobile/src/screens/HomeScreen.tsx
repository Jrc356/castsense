/**
 * CastSense Home Screen
 * 
 * Mode selection screen where users can:
 * - Choose analysis mode (General/Specific)
 * - Set target species (for Specific mode)
 * - Set optional context (platform, gear, constraints)
 * - Start photo or video capture
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
import {collectMetadata, extractExifMetadata, getCurrentLocation} from '../services/metadata';
import {analyzeMedia, type UploadProgress} from '../services/api';
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
  } = useApp();

  // Local form state
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(state.mode);
  const [targetSpecies, setTargetSpecies] = useState<string>(state.targetSpecies || '');
  const [platform, setPlatform] = useState<PlatformContext | null>(state.platformContext);
  const [gear, setGear] = useState<GearType>(state.gearType);
  const [notes, setNotes] = useState<string>(state.userConstraints.notes || '');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

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
      // Request library and location permissions
      const permissions = await requestLibraryPermissions();
      
      if (!permissions.mediaLibrary) {
        Alert.alert(
          'Photo Library Required',
          'Photo library permission is required to select existing photos and videos.',
        );
        return;
      }

      // Pick media from library
      const media = await pickMediaFromLibrary();
      
      if (!media) {
        // User canceled selection
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

      // Start capture state (for upload/analysis flow)
      startCapture(media.type);

      // Handle EXIF data: let user choose between original or current location/time
      let useExifData = false;
      if (media.exif && (media.exif.location || media.exif.timestamp)) {
        useExifData = await showExifChoiceDialog(media.exif);
      }

      // Collect metadata
      let captureTimestamp = new Date();
      let includeLocation = true;
      
      if (useExifData && media.exif) {
        const exifMetadata = extractExifMetadata(media.exif);
        
        // Use EXIF timestamp if available
        if (exifMetadata.timestamp) {
          captureTimestamp = exifMetadata.timestamp;
        }
        
        // Collect metadata with EXIF location instead of current location
        const metadata = await collectMetadata({
          mode: selectedMode,
          targetSpecies: selectedMode === 'specific' ? targetSpecies.trim() : undefined,
          platformContext: platform || undefined,
          gearType: gear,
          captureType: media.type,
          captureTimestamp,
          userConstraints: notes.trim() ? { notes: notes.trim() } : undefined,
          includeLocation: false, // We'll add EXIF location manually
        });

        // Add EXIF location to metadata
        if (exifMetadata.location) {
          metadata.location = {
            lat: exifMetadata.location.lat,
            lon: exifMetadata.location.lon,
            altitude_m: exifMetadata.location.altitude_m,
          };
        }

        // Upload and analyze
        await uploadAndAnalyze(media.uri, media.mimeType, metadata);
      } else {
        // Use current location and timestamp
        const metadata = await collectMetadata({
          mode: selectedMode,
          targetSpecies: selectedMode === 'specific' ? targetSpecies.trim() : undefined,
          platformContext: platform || undefined,
          gearType: gear,
          captureType: media.type,
          captureTimestamp,
          userConstraints: notes.trim() ? { notes: notes.trim() } : undefined,
          includeLocation: true,
        });

        // Upload and analyze
        await uploadAndAnalyze(media.uri, media.mimeType, metadata);
      }

    } catch (error) {
      console.error('Library selection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to select media';
      
      Alert.alert('Error', errorMessage);
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
  ]);

  // Show EXIF location/timestamp choice dialog
  const showExifChoiceDialog = (exif: NonNullable<LibraryMediaResult['exif']>): Promise<boolean> => {
    return new Promise((resolve) => {
      const locationText = exif.location
        ? `${exif.location.latitude.toFixed(4)}, ${exif.location.longitude.toFixed(4)}`
        : 'Not available';
      
      const timestampText = exif.timestamp
        ? exif.timestamp.toLocaleDateString() + ' at ' + exif.timestamp.toLocaleTimeString()
        : 'Not available';
      
      const message = `This photo contains embedded location and time data:\n\nOriginal: ${locationText}\n${timestampText}\n\nWould you like to use this original data, or use your current location and time?`;

      Alert.alert(
        'Use Original Location & Time?',
        message,
        [
          {
            text: 'Use Current',
            onPress: () => resolve(false),
            style: 'cancel',
          },
          {
            text: 'Use Original',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  };

  // Upload and analyze media
  const uploadAndAnalyze = useCallback(async (
    uri: string,
    mimeType: string,
    metadata: any
  ) => {
    try {
      setIsProcessing(true);

      // Upload and analyze
      const response = await analyzeMedia(
        { uri, mimeType },
        metadata,
        (progress: UploadProgress) => {
          // Progress tracking could be added here
          console.log('Upload progress:', progress.percentage);
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Analysis failed');
      }

      // Navigate to results
      navigation.navigate('Results', {
        result: {
          request_id: response.data.request_id,
          status: response.data.status,
          rendering_mode: response.data.rendering_mode,
          result: response.data.result,
          context_pack: response.data.context_pack,
          timings_ms: response.data.timings_ms,
          enrichment_status: response.data.enrichment_status,
        },
        mediaUri: uri,
      });

    } catch (error) {
      console.error('Upload/analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
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
  }, [navigation]);

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

        {/* Capture Buttons */}
        <View style={styles.captureSection}>
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
