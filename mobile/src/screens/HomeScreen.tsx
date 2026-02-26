/**
 * CastSense Home Screen
 * 
 * Unified form and preview screen where users can:
 * - Choose analysis mode (General/Specific)
 * - Set target species (for Specific mode)
 * - Set optional context (platform, gear, constraints)
 * - Start photo or video capture
 * - Preview captured media before analysis
 * - Edit fields after capture
 * - Trigger analysis manually via Analyze button
 */

import React, {useState, useCallback, useLayoutEffect, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useApp} from '../state/AppContext';
import {useAppNavigation} from '../navigation/hooks';
import {
  requestCapturePermissions,
  requestLocationPermission,
} from '../services/permissions';
import {runAnalysis} from '../services/analysis-orchestrator';
import {getCurrentLocation} from '../services/metadata';
import {getApiKey} from '../services/api-key-storage';
import {fetchAvailableModels} from '../services/model-discovery';
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
    canStartAnalysis,
    selectMode,
    setPlatformContext,
    setGearType,
    setUserConstraints,
    selectModel,
    setAvailableModels,
    startCapture,
    startAnalysis,
    updateProcessingProgress,
    updateEnrichmentProgress,
    updateAIProgress,
    receiveResults,
    handleError,
    reset,
  } = useApp();

  // Local form state
  const [selectedMode, setSelectedMode] = useState<AnalysisMode | null>(state.mode);
  const [targetSpecies, setTargetSpecies] = useState<string>(state.targetSpecies || '');
  const [platform, setPlatform] = useState<PlatformContext | null>(state.platformContext);
  const [gear, setGear] = useState<GearType>(state.gearType);
  const [notes, setNotes] = useState<string>(state.userConstraints.notes || '');
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Track if we're currently running analysis to prevent duplicate runs
  const isAnalyzing = useRef(false);

  // Check if we're in an analyzing state (to show loading overlay)
  const isInAnalysis = state.state === 'Processing' || state.state === 'Enriching' || state.state === 'Analyzing';

  // Determine which analysis stage we're in for progress display
  const getAnalysisStage = (): { label: string; progress: number } | null => {
    if (state.state === 'Processing') {
      return { label: 'Processing image...', progress: state.processingProgress };
    }
    if (state.state === 'Enriching') {
      return { label: 'Enriching with location data...', progress: state.enrichmentProgress };
    }
    if (state.state === 'Analyzing') {
      return { label: 'Analyzing with AI...', progress: state.aiProgress };
    }
    return null;
  };

  // Load available models from OpenAI API on component mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoadingModels(true);
        setModelLoadError(null);

        const apiKey = await getApiKey();
        if (!apiKey) {
          setModelLoadError('API key not configured');
          return;
        }

        // Fetch all available models (sorted by tier and creation date)
        const models = await fetchAvailableModels(apiKey);
        if (models.length > 0) {
          setAvailableModels(models);
          // Select latest GPT-5 model if available, otherwise select first model
          if (!state.selectedModel) {
            const gpt5Model = models.find(m => m.toLowerCase().startsWith('gpt-5'));
            selectModel(gpt5Model || models[0]);
          }
        } else {
          setModelLoadError('No models available');
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        setModelLoadError('Failed to fetch models');
        // Fallback to default model
        selectModel('gpt-4o');
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, []);

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

  // Run analysis when state transitions to Processing
  useEffect(() => {
    if (state.state !== 'Processing' || !state.captureResult || isAnalyzing.current) {
      return;
    }

    // Capture the captureResult to satisfy TypeScript's strict null checks
    const captureResult = state.captureResult;

    const performAnalysis = async () => {
      isAnalyzing.current = true;

      try {
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
          photoUri: captureResult.uri,
          location,
          options: {mode: state.mode || 'general'},
          apiKey,
          model: state.selectedModel || 'gpt-4o',
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
            mediaUri: captureResult.uri,
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
        console.error('Analysis error:', error);
        const appError = {
          code: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : 'Analysis failed. Please try again.',
          retryable: true,
        };
        handleError(appError);
        navigation.navigate('Error', {
          error: appError,
          canRetry: true,
        });
      } finally {
        isAnalyzing.current = false;
      }
    };

    performAnalysis();
  }, [state.state, state.captureResult, state.mode, navigation, updateProcessingProgress, updateEnrichmentProgress, updateAIProgress, receiveResults, handleError]);

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

  // Handle analyze button (after media is captured)
  const handleAnalyze = useCallback(async () => {
    if (!canStartAnalysis) {
      return;
    }

    if (!selectedMode) {
      Alert.alert('Select Mode', 'Please select an analysis mode first.');
      return;
    }

    if (selectedMode === 'specific' && !targetSpecies.trim()) {
      Alert.alert('Enter Species', 'Please enter a target species for Specific mode.');
      return;
    }

    // Update app state with current form values
    selectMode(selectedMode, selectedMode === 'specific' ? targetSpecies.trim() : undefined);
    
    if (platform) {
      setPlatformContext(platform);
    }
    
    setGearType(gear);
    
    if (notes.trim()) {
      setUserConstraints({ notes: notes.trim() });
    }

    // Start analysis
    startAnalysis();

    // Navigation will happen from the analysis orchestrator
  }, [
    canStartAnalysis,
    selectedMode,
    targetSpecies,
    platform,
    gear,
    notes,
    selectMode,
    setPlatformContext,
    setGearType,
    setUserConstraints,
    startAnalysis,
  ]);

  // Handle retake
  const handleRetake = useCallback(() => {
    reset();
    setSelectedMode(null);
    setTargetSpecies('');
    setPlatform(null);
    setGear('unknown');
    setNotes('');
  }, [reset]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isInAnalysis}
      >
        {/* Capture Button (moved to top) */}
        <View style={styles.captureSection}>
          {(state.state === 'ReadyToAnalyze' || isInAnalysis) && state.captureResult ? (
            <TouchableOpacity
              style={[
                styles.captureButton, 
                styles.analyzeButton,
                isInAnalysis && styles.buttonDisabled
              ]}
              onPress={handleAnalyze}
              activeOpacity={0.8}
              disabled={!canStartAnalysis || isInAnalysis}
            >
              {isInAnalysis ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" style={styles.buttonSpinner} />
                  <Text style={styles.captureButtonText}>Analyzing...</Text>
                </>
              ) : (
                <Text style={styles.captureButtonText}>Analyze</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.captureButton, styles.photoButton]}
              onPress={handleStartCapture}
              activeOpacity={0.8}
            >
              <Text style={styles.captureButtonText}>Take Photo</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Preview Section (when media is captured or analyzing) */}
        {(state.state === 'ReadyToAnalyze' || isInAnalysis) && state.captureResult && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={styles.previewImageContainer}>
              <Image
                source={{ uri: state.captureResult.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              {/* Loading Overlay */}
              {isInAnalysis && (
                <View style={styles.loadingOverlay}>
                  <View style={styles.loadingContent}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.loadingText}>
                      {getAnalysisStage()?.label || 'Analyzing...'}
                    </Text>
                    {getAnalysisStage()?.progress !== undefined && getAnalysisStage()!.progress > 0 && (
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { 
                              width: Math.round(getAnalysisStage()!.progress * 100) + '%'
                            } as any
                          ]} 
                        />
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
            {!isInAnalysis && (
              <>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={handleRetake}
                  activeOpacity={0.7}
                >
                  <Text style={styles.retakeButtonText}>Retake Photo</Text>
                </TouchableOpacity>
                <Text style={styles.editHint}>Edit details below, then analyze:</Text>
              </>
            )}
          </View>
        )}
        {/* Mode Selection */}
        <View style={[styles.section, isInAnalysis && styles.sectionDisabled]}>
          <Text style={styles.sectionTitle}>Analysis Mode</Text>
          <View style={styles.modeContainer}>
            <ModeButton
              title="General"
              description="Identify likely species and get tailored tactics for your spot"
              selected={selectedMode === 'general'}
              onPress={() => !isInAnalysis && handleModeSelect('general')}
            />
            <ModeButton
              title="Specific"
              description="Get tactics optimized for a specific target species"
              selected={selectedMode === 'specific'}
              onPress={() => !isInAnalysis && handleModeSelect('specific')}
            />
          </View>
        </View>

        {/* Target Species (for Specific mode) */}
        {selectedMode === 'specific' && (
          <View style={[styles.section, isInAnalysis && styles.sectionDisabled]}>
            <Text style={styles.sectionTitle}>Target Species</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Largemouth Bass, Walleye, Trout"
              value={targetSpecies}
              onChangeText={setTargetSpecies}
              autoCapitalize="words"
              returnKeyType="done"
              editable={!isInAnalysis}
            />
          </View>
        )}

        {/* AI Model Selection */}
        <View style={[styles.section, isInAnalysis && styles.sectionDisabled]}>
          <Text style={styles.sectionTitle}>AI Model</Text>
          {loadingModels ? (
            <View style={styles.modelDisplay}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.modelDisplayText}>Loading models...</Text>
            </View>
          ) : modelLoadError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{modelLoadError}</Text>
              <Text style={styles.errorSubtext}>Using default: {state.selectedModel || 'gpt-4o'}</Text>
            </View>
          ) : state.availableModels.length > 0 ? (
            <>
              <TouchableOpacity
                style={styles.modelSelectorButton}
                onPress={() => !isInAnalysis && setShowModelSelector(true)}
                disabled={isInAnalysis}
              >
                <Text style={styles.modelSelectorButtonText}>
                  {state.selectedModel || 'Select model'}
                </Text>
                <Text style={styles.modelSelectorButtonArrow}>▼</Text>
              </TouchableOpacity>
              
              {/* Model Selection Modal */}
              <Modal
                visible={showModelSelector}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModelSelector(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Select AI Model</Text>
                      <TouchableOpacity
                        onPress={() => setShowModelSelector(false)}
                        style={styles.modalCloseButton}
                      >
                        <Text style={styles.modalCloseText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <FlatList
                      data={state.availableModels}
                      keyExtractor={(item) => item}
                      renderItem={({ item: model }) => (
                        <TouchableOpacity
                          style={[
                            styles.modelOption,
                            state.selectedModel === model && styles.modelOptionSelected,
                          ]}
                          onPress={() => {
                            selectModel(model);
                            setShowModelSelector(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.modelOptionText,
                              state.selectedModel === model && styles.modelOptionTextSelected,
                            ]}
                          >
                            {model}
                          </Text>
                          {state.selectedModel === model && (
                            <Text style={styles.modelOptionCheckmark}>✓</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      scrollEnabled
                      nestedScrollEnabled
                    />
                  </View>
                </View>
              </Modal>
            </>
          ) : (
            <Text style={styles.errorText}>No models available</Text>
          )}
        </View>

        {/* Platform Context */}
        <View style={[styles.section, isInAnalysis && styles.sectionDisabled]}>
          <Text style={styles.sectionTitle}>Fishing From (Optional)</Text>
          <View style={styles.optionRow}>
            <OptionButton
              title="Shore"
              selected={platform === 'shore'}
              onPress={() => !isInAnalysis && setPlatform(platform === 'shore' ? null : 'shore')}
            />
            <OptionButton
              title="Kayak"
              selected={platform === 'kayak'}
              onPress={() => !isInAnalysis && setPlatform(platform === 'kayak' ? null : 'kayak')}
            />
            <OptionButton
              title="Boat"
              selected={platform === 'boat'}
              onPress={() => !isInAnalysis && setPlatform(platform === 'boat' ? null : 'boat')}
            />
          </View>
        </View>

        {/* Gear Type */}
        <View style={[styles.section, isInAnalysis && styles.sectionDisabled]}>
          <Text style={styles.sectionTitle}>Gear Type (Optional)</Text>
          <View style={styles.optionRow}>
            <OptionButton
              title="Spinning"
              selected={gear === 'spinning'}
              onPress={() => !isInAnalysis && setGear(gear === 'spinning' ? 'unknown' : 'spinning')}
            />
            <OptionButton
              title="Baitcast"
              selected={gear === 'baitcasting'}
              onPress={() => !isInAnalysis && setGear(gear === 'baitcasting' ? 'unknown' : 'baitcasting')}
            />
            <OptionButton
              title="Fly"
              selected={gear === 'fly'}
              onPress={() => !isInAnalysis && setGear(gear === 'fly' ? 'unknown' : 'fly')}
            />
          </View>
        </View>

        {/* Notes */}
        <View style={[styles.section, isInAnalysis && styles.sectionDisabled]}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            placeholder="Any additional context..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            editable={!isInAnalysis}
          />
        </View>

        {/* (captureSection removed from bottom — moved above preview and mode selection) */}
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
    marginBottom: 20,
  },
  captureButton: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
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
  previewSection: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c6c70',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#e5e5ea',
    marginBottom: 12,
  },
  retakeButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 12,
  },
  retakeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  editHint: {
    fontSize: 14,
    color: '#6c6c70',
    fontStyle: 'italic',
  },
  analyzeButton: {
    backgroundColor: '#34c759',
  },
  previewImageContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  sectionDisabled: {
    opacity: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonSpinner: {
    marginRight: 8,
  },
  pickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 0,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    flex: 1,
    color: '#000000',
  },
  errorContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  errorText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
  },
  errorSubtext: {
    color: '#856404',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modelDisplay: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modelDisplayText: {
    color: '#6c6c70',
    fontSize: 14,
  },
  modelSelectorButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  modelSelectorButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '500',
  },
  modelSelectorButtonArrow: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#6c6c70',
  },
  modelOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
  },
  modelOptionSelected: {
    backgroundColor: '#f0f7ff',
  },
  modelOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  modelOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  modelOptionCheckmark: {
    fontSize: 18,
    color: '#34c759',
    fontWeight: '700',
  },
});
