/**
 * CastSense State Machine
 * 
 * States: Idle → ModeSelected → Capturing → Uploading → Analyzing → Results → Error
 * 
 * Implements the client state machine per spec §5.3
 */

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppState =
  | 'Idle'
  | 'ModeSelected'
  | 'Capturing'
  | 'Uploading'
  | 'Analyzing'
  | 'Results'
  | 'Error';

export type AnalysisMode = 'general' | 'specific';
export type CaptureType = 'photo' | 'video';
export type PlatformContext = 'shore' | 'kayak' | 'boat';
export type GearType = 'spinning' | 'baitcasting' | 'fly' | 'unknown';

export interface UserConstraints {
  lures_available?: string[];
  line_test_lb?: number;
  notes?: string;
}

export interface CaptureResult {
  uri: string;
  type: CaptureType;
  width?: number;
  height?: number;
  durationMs?: number;
  sizeBytes?: number;
  mimeType: string;
}

export interface AnalysisResult {
  request_id: string;
  status: 'ok' | 'degraded' | 'error';
  rendering_mode?: 'overlay' | 'text_only';
  result?: unknown;
  context_pack?: unknown;
  timings_ms?: Record<string, number>;
  enrichment_status?: Record<string, string>;
}

export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// State Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface MachineState {
  state: AppState;
  
  // Mode selection
  mode: AnalysisMode | null;
  targetSpecies: string | null;
  platformContext: PlatformContext | null;
  gearType: GearType;
  userConstraints: UserConstraints;
  
  // Capture
  captureType: CaptureType | null;
  captureResult: CaptureResult | null;
  
  // Results
  analysisResult: AnalysisResult | null;
  
  // Error
  error: AppError | null;
  
  // Progress tracking
  uploadProgress: number;
  retryCount: number;
}

export const initialState: MachineState = {
  state: 'Idle',
  mode: null,
  targetSpecies: null,
  platformContext: null,
  gearType: 'unknown',
  userConstraints: {},
  captureType: null,
  captureResult: null,
  analysisResult: null,
  error: null,
  uploadProgress: 0,
  retryCount: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'SELECT_MODE'; payload: { mode: AnalysisMode; targetSpecies?: string } }
  | { type: 'SET_PLATFORM_CONTEXT'; payload: PlatformContext | null }
  | { type: 'SET_GEAR_TYPE'; payload: GearType }
  | { type: 'SET_USER_CONSTRAINTS'; payload: UserConstraints }
  | { type: 'START_CAPTURE'; payload: CaptureType }
  | { type: 'COMPLETE_CAPTURE'; payload: CaptureResult }
  | { type: 'START_UPLOAD' }
  | { type: 'UPDATE_UPLOAD_PROGRESS'; payload: number }
  | { type: 'START_ANALYSIS' }
  | { type: 'RECEIVE_RESULTS'; payload: AnalysisResult }
  | { type: 'HANDLE_ERROR'; payload: AppError }
  | { type: 'RETRY' }
  | { type: 'RESET' };

// ─────────────────────────────────────────────────────────────────────────────
// Action Creators
// ─────────────────────────────────────────────────────────────────────────────

export const actions = {
  selectMode: (mode: AnalysisMode, targetSpecies?: string): AppAction => ({
    type: 'SELECT_MODE',
    payload: { mode, targetSpecies },
  }),

  setPlatformContext: (platform: PlatformContext | null): AppAction => ({
    type: 'SET_PLATFORM_CONTEXT',
    payload: platform,
  }),

  setGearType: (gearType: GearType): AppAction => ({
    type: 'SET_GEAR_TYPE',
    payload: gearType,
  }),

  setUserConstraints: (constraints: UserConstraints): AppAction => ({
    type: 'SET_USER_CONSTRAINTS',
    payload: constraints,
  }),

  startCapture: (captureType: CaptureType): AppAction => ({
    type: 'START_CAPTURE',
    payload: captureType,
  }),

  completeCapture: (result: CaptureResult): AppAction => ({
    type: 'COMPLETE_CAPTURE',
    payload: result,
  }),

  startUpload: (): AppAction => ({
    type: 'START_UPLOAD',
  }),

  updateUploadProgress: (progress: number): AppAction => ({
    type: 'UPDATE_UPLOAD_PROGRESS',
    payload: progress,
  }),

  startAnalysis: (): AppAction => ({
    type: 'START_ANALYSIS',
  }),

  receiveResults: (result: AnalysisResult): AppAction => ({
    type: 'RECEIVE_RESULTS',
    payload: result,
  }),

  handleError: (error: AppError): AppAction => ({
    type: 'HANDLE_ERROR',
    payload: error,
  }),

  retry: (): AppAction => ({
    type: 'RETRY',
  }),

  reset: (): AppAction => ({
    type: 'RESET',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

export function appReducer(state: MachineState, action: AppAction): MachineState {
  switch (action.type) {
    case 'SELECT_MODE':
      return {
        ...state,
        state: 'ModeSelected',
        mode: action.payload.mode,
        targetSpecies: action.payload.targetSpecies ?? null,
        error: null,
      };

    case 'SET_PLATFORM_CONTEXT':
      return {
        ...state,
        platformContext: action.payload,
      };

    case 'SET_GEAR_TYPE':
      return {
        ...state,
        gearType: action.payload,
      };

    case 'SET_USER_CONSTRAINTS':
      return {
        ...state,
        userConstraints: action.payload,
      };

    case 'START_CAPTURE':
      if (state.state !== 'ModeSelected' && state.state !== 'Idle') {
        console.warn('Invalid state transition: START_CAPTURE from', state.state);
        return state;
      }
      return {
        ...state,
        state: 'Capturing',
        captureType: action.payload,
        captureResult: null,
        error: null,
      };

    case 'COMPLETE_CAPTURE':
      if (state.state !== 'Capturing') {
        console.warn('Invalid state transition: COMPLETE_CAPTURE from', state.state);
        return state;
      }
      return {
        ...state,
        captureResult: action.payload,
      };

    case 'START_UPLOAD':
      if (!state.captureResult) {
        console.warn('Cannot start upload without capture result');
        return state;
      }
      return {
        ...state,
        state: 'Uploading',
        uploadProgress: 0,
        error: null,
      };

    case 'UPDATE_UPLOAD_PROGRESS':
      return {
        ...state,
        uploadProgress: action.payload,
      };

    case 'START_ANALYSIS':
      if (state.state !== 'Uploading') {
        console.warn('Invalid state transition: START_ANALYSIS from', state.state);
        return state;
      }
      return {
        ...state,
        state: 'Analyzing',
        uploadProgress: 100,
      };

    case 'RECEIVE_RESULTS':
      return {
        ...state,
        state: 'Results',
        analysisResult: action.payload,
        error: null,
        retryCount: 0,
      };

    case 'HANDLE_ERROR':
      return {
        ...state,
        state: 'Error',
        error: action.payload,
      };

    case 'RETRY':
      // Go back to appropriate state based on where we can retry from
      if (state.captureResult && state.retryCount < 1) {
        return {
          ...state,
          state: 'Uploading',
          error: null,
          retryCount: state.retryCount + 1,
          uploadProgress: 0,
        };
      }
      // If we can't retry, go back to mode selection
      return {
        ...state,
        state: state.mode ? 'ModeSelected' : 'Idle',
        error: null,
        captureResult: null,
        analysisResult: null,
        retryCount: 0,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// State Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function canStartCapture(state: MachineState): boolean {
  return state.state === 'ModeSelected' || state.state === 'Idle';
}

export function canRetry(state: MachineState): boolean {
  return (
    state.state === 'Error' &&
    state.error?.retryable === true &&
    state.retryCount < 1
  );
}

export function getStateProgress(state: MachineState): number {
  switch (state.state) {
    case 'Idle':
      return 0;
    case 'ModeSelected':
      return 10;
    case 'Capturing':
      return 20;
    case 'Uploading':
      return 20 + (state.uploadProgress * 0.4);
    case 'Analyzing':
      return 70;
    case 'Results':
      return 100;
    case 'Error':
      return 0;
    default:
      return 0;
  }
}
