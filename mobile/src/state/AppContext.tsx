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
  startCapture: () => void;
  completeCapture: (result: CaptureResult) => void;
  startAnalysis: () => void;
  startProcessing: () => void;
  updateProcessingProgress: (progress: number) => void;
  startEnrichment: () => void;
  updateEnrichmentProgress: (progress: number) => void;
  startAIAnalysis: () => void;
  updateAIProgress: (progress: number) => void;
  receiveResults: (result: AnalysisResult) => void;
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
  const [state, dispatch] = useReducer(appReducer, initialState);

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
    (result: AnalysisResult) => {
      dispatch(actions.receiveResults(result));
    },
    []
  );

  const handleError = useCallback(
    (error: AppError) => {
      dispatch(actions.handleError(error));
    },
    []
  );

  const retry = useCallback(() => {
    dispatch(actions.retry());
  }, []);

  const reset = useCallback(() => {
    dispatch(actions.reset());
  }, []);

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
