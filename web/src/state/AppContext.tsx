/**
 * CastSense App Context (Photo-Only, Local Processing)
 * 
 * Provides global state management using React Context + useReducer
 * Wraps the state machine for use throughout the app
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

import {
  appReducer,
  initialState,
  actions,
  type MachineState,
  type AppAction,
  type AnalysisMode,
  type CaptureResult,
  type AnalysisResult,
  type AppError,
  type PlatformContext,
  type GearType,
  type UserConstraints,
  canStartCapture,
  canStartAnalysis,
  canRetry,
  getStateProgress,
} from './machine';

import { loadSelectedModel, saveSelectedModel, getDefaultModel } from '../services/model-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Session Persistence
// ─────────────────────────────────────────────────────────────────────────────

const PERSIST_KEYS = {
  analysisResult: 'castsense:lastAnalysisResult',
  captureResult: 'castsense:lastCaptureResult',
  sessionId: 'castsense:lastSessionId',
} as const;

function persistSession(state: MachineState): void {
  if (state.state === 'Results' && state.analysisResult && state.captureResult && state.sessionId) {
    try {
      localStorage.setItem(PERSIST_KEYS.analysisResult, JSON.stringify(state.analysisResult));
      localStorage.setItem(PERSIST_KEYS.captureResult, JSON.stringify(state.captureResult));
      localStorage.setItem(PERSIST_KEYS.sessionId, state.sessionId);
    } catch {
      // localStorage may be full or unavailable
    }
  }
}

function clearPersistedSession(): void {
  try {
    localStorage.removeItem(PERSIST_KEYS.analysisResult);
    localStorage.removeItem(PERSIST_KEYS.captureResult);
    localStorage.removeItem(PERSIST_KEYS.sessionId);
  } catch {
    // ignore
  }
}

function loadPersistedSession(): Partial<Pick<MachineState, 'analysisResult' | 'captureResult' | 'sessionId' | 'state'>> | null {
  try {
    const rawAnalysis = localStorage.getItem(PERSIST_KEYS.analysisResult);
    const rawCapture = localStorage.getItem(PERSIST_KEYS.captureResult);
    const rawSessionId = localStorage.getItem(PERSIST_KEYS.sessionId);
    if (!rawAnalysis || !rawCapture || !rawSessionId) return null;
    return {
      analysisResult: JSON.parse(rawAnalysis) as AnalysisResult,
      captureResult: JSON.parse(rawCapture) as CaptureResult,
      sessionId: rawSessionId,
      state: 'Results',
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Types
// ─────────────────────────────────────────────────────────────────────────────

interface AppContextValue {
  // State
  state: MachineState;
  
  // Computed
  canStartCapture: boolean;
  canStartAnalysis: boolean;
  canRetry: boolean;
  progress: number;
  
  // Actions
  selectMode: (mode: AnalysisMode, targetSpecies?: string) => void;
  setPlatformContext: (platform: PlatformContext | null) => void;
  setGearType: (gearType: GearType) => void;
  setUserConstraints: (constraints: UserConstraints) => void;
  selectModel: (model: string) => void;
  setAvailableModels: (models: string[]) => void;
  startCapture: () => void;
  completeCapture: (result: CaptureResult) => void;
  startAnalysis: () => void;
  startProcessing: () => void;
  updateProcessingProgress: (progress: number) => void;
  startEnrichment: () => void;
  updateEnrichmentProgress: (progress: number) => void;
  startAIAnalysis: () => void;
  updateAIProgress: (progress: number) => void;
  receiveResults: (result: AnalysisResult, sessionId: string) => void;
  askFollowUp: (question: string) => void;
  handleError: (error: AppError) => void;
  retry: () => void;
  reset: () => void;
  
  // Raw dispatch for advanced use
  dispatch: React.Dispatch<AppAction>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps): React.JSX.Element {
  const [state, dispatch] = useReducer(appReducer, undefined, (): MachineState => {
    const persisted = loadPersistedSession();
    if (!persisted) return initialState;
    return { ...initialState, ...persisted };
  });

  // Memoized action dispatchers
  const selectMode = useCallback(
    (mode: AnalysisMode, targetSpecies?: string) => {
      dispatch(actions.selectMode(mode, targetSpecies));
    },
    []
  );

  const setPlatformContext = useCallback(
    (platform: PlatformContext | null) => {
      dispatch(actions.setPlatformContext(platform));
    },
    []
  );

  const setGearType = useCallback(
    (gearType: GearType) => {
      dispatch(actions.setGearType(gearType));
    },
    []
  );

  const setUserConstraints = useCallback(
    (constraints: UserConstraints) => {
      dispatch(actions.setUserConstraints(constraints));
    },
    []
  );

  const selectModel = useCallback(
    (model: string) => {
      dispatch(actions.selectModel(model));
      // Persist to storage
      saveSelectedModel(model).catch((error) => {
        console.error('Failed to save model selection:', error);
      });
    },
    []
  );

  const setAvailableModels = useCallback(
    (models: string[]) => {
      dispatch(actions.setAvailableModels(models));
    },
    []
  );

  // Load persisted model selection on mount
  useEffect(() => {
    const loadPersistedModel = async () => {
      try {
        const persistedModel = await loadSelectedModel();
        if (persistedModel) {
          dispatch(actions.selectModel(persistedModel));
        } else {
          // Use default model if none saved
          const defaultModel = getDefaultModel();
          dispatch(actions.selectModel(defaultModel));
        }
      } catch (error) {
        console.error('Failed to load persisted model:', error);
        // Fallback to default model
        const defaultModel = getDefaultModel();
        dispatch(actions.selectModel(defaultModel));
      }
    };
    
    loadPersistedModel();
  }, []);

  const startCapture = useCallback(() => {
    dispatch(actions.startCapture());
  }, []);

  const completeCapture = useCallback(
    (result: CaptureResult) => {
      dispatch(actions.completeCapture(result));
    },
    []
  );

  const startAnalysis = useCallback(() => {
    dispatch(actions.startAnalysis());
  }, []);

  const startProcessing = useCallback(() => {
    dispatch(actions.startProcessing());
  }, []);

  const updateProcessingProgress = useCallback(
    (progress: number) => {
      dispatch(actions.updateProcessingProgress(progress));
    },
    []
  );

  const startEnrichment = useCallback(() => {
    dispatch(actions.startEnrichment());
  }, []);

  const updateEnrichmentProgress = useCallback(
    (progress: number) => {
      dispatch(actions.updateEnrichmentProgress(progress));
    },
    []
  );

  const startAIAnalysis = useCallback(() => {
    dispatch(actions.startAIAnalysis());
  }, []);

  const updateAIProgress = useCallback(
    (progress: number) => {
      dispatch(actions.updateAIProgress(progress));
    },
    []
  );

  const receiveResults = useCallback(
    (result: AnalysisResult, sessionId: string) => {
      dispatch(actions.receiveResults(result, sessionId));
    },
    []
  );

  const handleError = useCallback(
    (error: AppError) => {
      dispatch(actions.handleError(error));
    },
    []
  );

  const askFollowUp = useCallback(
    (question: string) => {
      dispatch(actions.askFollowUp(question));
    },
    []
  );

  const retry = useCallback(() => {
    dispatch(actions.retry());
  }, []);

  const reset = useCallback(() => {
    dispatch(actions.reset());
  }, []);

  // Persist results on state change; clear on reset to Idle
  useEffect(() => {
    if (state.state === 'Results') {
      persistSession(state);
    }
    if (state.state === 'Idle') {
      clearPersistedSession();
    }
  }, [state.state, state.analysisResult, state.captureResult, state.sessionId]);

  // Memoized context value
  const value = useMemo<AppContextValue>(
    () => ({
      state,
      canStartCapture: canStartCapture(state),
      canStartAnalysis: canStartAnalysis(state),
      canRetry: canRetry(state),
      progress: getStateProgress(state),
      selectMode,
      setPlatformContext,
      setGearType,
      setUserConstraints,
      selectModel,
      setAvailableModels,
      startCapture,
      completeCapture,
      startAnalysis,
      startProcessing,
      updateProcessingProgress,
      startEnrichment,
      updateEnrichmentProgress,
      startAIAnalysis,
      updateAIProgress,
      receiveResults,
      askFollowUp,
      handleError,
      retry,
      reset,
      dispatch,
    }),
    [
      state,
      selectMode,
      setPlatformContext,
      setGearType,
      setUserConstraints,
      selectModel,
      setAvailableModels,
      startCapture,
      completeCapture,
      startAnalysis,
      startProcessing,
      updateProcessingProgress,
      startEnrichment,
      updateEnrichmentProgress,
      startAIAnalysis,
      updateAIProgress,
      receiveResults,
      askFollowUp,
      handleError,
      retry,
      reset,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Re-export types for convenience
export type {
  MachineState,
  AppAction,
  AnalysisMode,
  CaptureResult,
  AnalysisResult,
  AppError,
  PlatformContext,
  GearType,
  UserConstraints,
};
