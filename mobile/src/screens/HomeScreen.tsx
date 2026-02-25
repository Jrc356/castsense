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

import React, {useState, useCallback, useLayoutEffect} from 'react';
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
} from '../services/permissions';
import type {
  AnalysisMode,
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

  // Configure header with settings button
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.7}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Handle mode selection
  const handleModeSelect = useCallback((mode: AnalysisMode) => {
    setSelectedMode(mode);
    if (mode === 'general') {
      setTargetSpecies('');
    }
  }, []);

  // Start camera capture flow
  const handleStartCapture = useCallback(async () => {
    if (!selectedMode) {
      Alert.alert('Select Mode', 'Please select an analysis mode first.');
      return;
    }

    if (selectedMode === 'specific' && !targetSpecies.trim()) {
      Alert.alert('Enter Species', 'Please enter a target species for Specific mode.');
      return;
    }

    // Request camera and location permissions
    const permissions = await requestCapturePermissions();
    
    if (!permissions.camera) {
      Alert.alert(
        'Camera Required',
        'Camera permission is required to capture photos.',
      );
      return;
    }

    // Request location separately (optional but recommended)
    if (!permissions.location) {
      await requestLocationPermission();
    }

    // Update app state with selected mode and constraints
    selectMode(selectedMode, selectedMode === 'specific' ? targetSpecies.trim() : undefined);
    
    if (platform) {
      setPlatformContext(platform);
    }
    
    setGearType(gear);
    
    if (notes.trim()) {
      setUserConstraints({ notes: notes.trim() });
    }

    // Start camera capture
    startCapture();

    // Navigate to capture screen for local processing
    navigation.navigate('Capture');
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

        {/* Capture Button */}
        <View style={styles.captureSection}>
          <TouchableOpacity
            style={[styles.captureButton, styles.photoButton]}
            onPress={handleStartCapture}
            activeOpacity={0.8}
          >
            <Text style={styles.captureButtonText}>Take Photo</Text>
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
  captureButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerButton: {
    marginRight: 16,
    padding: 8,
  },
  headerButtonText: {
    fontSize: 24,
  },
});
