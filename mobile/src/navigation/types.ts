/**
 * Navigation Type Definitions
 * 
 * Centralized navigation types to avoid circular dependencies.
 */

import {type AnalysisResult, type AppError} from '../state/machine';

export type RootStackParamList = {
  Home: undefined;
  Capture: undefined;
  Results: {
    result: AnalysisResult;
    mediaUri: string;
  };
  Error: {
    error: AppError;
    canRetry: boolean;
  };
  Settings: undefined;
};

// Type helper for screens
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
