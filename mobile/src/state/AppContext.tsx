/**
 * CastSense App Context
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
  type CaptureType,
  type CaptureResult,
  type AnalysisResult,
  type AppError,
  type PlatformContext,
  type GearType,
  type UserConstraints,
  canStartCapture,
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
  canRetry: boolean;
  progress: number;
  
  // Actions
  selectMode: (mode: AnalysisMode, targetSpecies?: string) => void;
  setPlatformContext: (platform: PlatformContext | null) => void;
  setGearType: (gearType: GearType) => void;
  setUserConstraints: (constraints: UserConstraints) => void;
  startCapture: (captureType: CaptureType) => void;
  completeCapture: (result: CaptureResult) => void;
  startUpload: () => void;
  updateUploadProgress: (progress: number) => void;
  startAnalysis: () => void;
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

  const startCapture = useCallback(
    (captureType: CaptureType) => {
      dispatch(actions.startCapture(captureType));
    },
    []
  );

  const completeCapture = useCallback(
    (result: CaptureResult) => {
      dispatch(actions.completeCapture(result));
    },
    []
  );

  const startUpload = useCallback(() => {
    dispatch(actions.startUpload());
  }, []);

  const updateUploadProgress = useCallback(
    (progress: number) => {
      dispatch(actions.updateUploadProgress(progress));
    },
    []
  );

  const startAnalysis = useCallback(() => {
    dispatch(actions.startAnalysis());
  }, []);

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
      canRetry: canRetry(state),
      progress: getStateProgress(state),
      selectMode,
      setPlatformContext,
      setGearType,
      setUserConstraints,
      startCapture,
      completeCapture,
      startUpload,
      updateUploadProgress,
      startAnalysis,
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
      startUpload,
      updateUploadProgress,
      startAnalysis,
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
  CaptureType,
  CaptureResult,
  AnalysisResult,
  AppError,
  PlatformContext,
  GearType,
  UserConstraints,
};
