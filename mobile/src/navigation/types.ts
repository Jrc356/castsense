/**
 * Navigation Type Definitions
 * 
 * Centralized navigation types to avoid circular dependencies.
 */

import {type CaptureType, type AnalysisResult, type AppError} from '../state/machine';

export type RootStackParamList = {
  Home: undefined;
  Capture: {
    captureType: CaptureType;
  };
  Results: {
    result: AnalysisResult;
    mediaUri: string;
  };
  Error: {
    error: AppError;
    canRetry: boolean;
  };
};

// Type helper for screens
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
