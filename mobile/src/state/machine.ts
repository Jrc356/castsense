/**
 * CastSense State Machine (Photo-Only, Local Processing)
 * 
 * States: Idle → ModeSelected → Capturing → Processing → Enriching → Analyzing → Results | Error
 * 
 * Implements local analysis flow with OpenAI API (BYO-API-key model).
 */

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppState =
  | 'Idle'
  | 'ModeSelected'
  | 'Capturing'
  | 'ReadyToAnalyze'
  | 'Processing'
  | 'Enriching'
  | 'Analyzing'
  | 'Results'
  | 'FollowUp'
  | 'Error';

export type AnalysisMode = 'general' | 'specific';
export type PlatformContext = 'shore' | 'kayak' | 'boat';
export type GearType = 'spinning' | 'baitcasting' | 'fly' | 'unknown';

export interface UserConstraints {
  lures_available?: string[];
  line_test_lb?: number;
  notes?: string;
}

export interface CaptureResult {
  uri: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  mimeType: string;
}

export interface AnalysisResult {
  result: unknown;
  enrichment: unknown;
  validation: unknown;
  model: string;
  timings: {
    processing_ms: number;
    enrichment_ms: number;
    ai_ms: number;
    validation_ms: number;
    total_ms: number;
  };
}

export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
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
  
  // AI Model selection
  selectedModel: string | null;
  availableModels: string[];
  
  // Capture (photo only)
  captureResult: CaptureResult | null;
  
  // Results
  analysisResult: AnalysisResult | null;
  
  // Conversation memory
  sessionId: string | null;
  followUpQuestion: string | null;
  
  // Error
  error: AppError | null;
  
  // Progress tracking
  processingProgress: number; // 0-1
  enrichmentProgress: number; // 0-1
  aiProgress: number; // 0-1
  retryCount: number;
}

export const initialState: MachineState = {
  state: 'Idle',
  mode: null,
  targetSpecies: null,
  platformContext: null,
  gearType: 'unknown',
  userConstraints: {},
  selectedModel: null,
  availableModels: [],
  captureResult: null,
  analysisResult: null,
  sessionId: null,
  followUpQuestion: null,
  error: null,
  processingProgress: 0,
  enrichmentProgress: 0,
  aiProgress: 0,
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
  | { type: 'SELECT_MODEL'; payload: string }
  | { type: 'SET_AVAILABLE_MODELS'; payload: string[] }
  | { type: 'START_CAPTURE' }
  | { type: 'COMPLETE_CAPTURE'; payload: CaptureResult }
  | { type: 'START_ANALYSIS' }
  | { type: 'START_PROCESSING' }
  | { type: 'UPDATE_PROCESSING_PROGRESS'; payload: number }
  | { type: 'START_ENRICHMENT' }
  | { type: 'UPDATE_ENRICHMENT_PROGRESS'; payload: number }
  | { type: 'START_AI_ANALYSIS' }
  | { type: 'UPDATE_AI_PROGRESS'; payload: number }
  | { type: 'RECEIVE_RESULTS'; payload: { result: AnalysisResult; sessionId: string } }
  | { type: 'ASK_FOLLOW_UP'; payload: string }
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

  selectModel: (model: string): AppAction => ({
    type: 'SELECT_MODEL',
    payload: model,
  }),

  setAvailableModels: (models: string[]): AppAction => ({
    type: 'SET_AVAILABLE_MODELS',
    payload: models,
  }),

  startCapture: (): AppAction => ({
    type: 'START_CAPTURE',
  }),

  completeCapture: (result: CaptureResult): AppAction => ({
    type: 'COMPLETE_CAPTURE',
    payload: result,
  }),

  startAnalysis: (): AppAction => ({
    type: 'START_ANALYSIS',
  }),

  startProcessing: (): AppAction => ({
    type: 'START_PROCESSING',
  }),

  updateProcessingProgress: (progress: number): AppAction => ({
    type: 'UPDATE_PROCESSING_PROGRESS',
    payload: progress,
  }),

  startEnrichment: (): AppAction => ({
    type: 'START_ENRICHMENT',
  }),

  updateEnrichmentProgress: (progress: number): AppAction => ({
    type: 'UPDATE_ENRICHMENT_PROGRESS',
    payload: progress,
  }),

  startAIAnalysis: (): AppAction => ({
    type: 'START_AI_ANALYSIS',
  }),

  updateAIProgress: (progress: number): AppAction => ({
    type: 'UPDATE_AI_PROGRESS',
    payload: progress,
  }),

  receiveResults: (result: AnalysisResult, sessionId: string): AppAction => ({
    type: 'RECEIVE_RESULTS',
    payload: { result, sessionId },
  }),

  askFollowUp: (question: string): AppAction => ({
    type: 'ASK_FOLLOW_UP',
    payload: question,
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
        // Preserve ReadyToAnalyze state if we already have a capture
        // This allows updating mode/species after capturing but before analyzing
        state: state.state === 'ReadyToAnalyze' ? 'ReadyToAnalyze' : 'ModeSelected',
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

    case 'SELECT_MODEL':
      return {
        ...state,
        selectedModel: action.payload,
      };

    case 'SET_AVAILABLE_MODELS':
      return {
        ...state,
        availableModels: action.payload,
      };

    case 'START_CAPTURE':
      if (state.state !== 'ModeSelected' && state.state !== 'Idle') {
        console.warn('Invalid state transition: START_CAPTURE from', state.state);
        return state;
      }
      return {
        ...state,
        state: 'Capturing',
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
        state: 'ReadyToAnalyze',
        captureResult: action.payload,
      };

    case 'START_ANALYSIS':
      if (state.state !== 'ReadyToAnalyze') {
        console.warn('Invalid state transition: START_ANALYSIS from', state.state);
        return state;
      }
      if (!state.captureResult) {
        console.warn('Cannot start analysis without capture result');
        return state;
      }
      return {
        ...state,
        state: 'Processing',
        processingProgress: 0,
        error: null,
      };

    case 'START_PROCESSING':
      // This can be dispatched from ReadyToAnalyze (via START_ANALYSIS) or directly
      if (!state.captureResult) {
        console.warn('Cannot start processing without capture result');
        return state;
      }
      return {
        ...state,
        state: 'Processing',
        processingProgress: 0,
        error: null,
      };

    case 'UPDATE_PROCESSING_PROGRESS':
      return {
        ...state,
        processingProgress: action.payload,
      };

    case 'START_ENRICHMENT':
      if (state.state !== 'Processing') {
        console.warn('Invalid state transition: START_ENRICHMENT from', state.state);
        return state;
      }
      return {
        ...state,
        state: 'Enriching',
        processingProgress: 1,
        enrichmentProgress: 0,
      };

    case 'UPDATE_ENRICHMENT_PROGRESS':
      return {
        ...state,
        enrichmentProgress: action.payload,
      };

    case 'START_AI_ANALYSIS':
      if (state.state !== 'Enriching') {
        console.warn('Invalid state transition: START_AI_ANALYSIS from', state.state);
        return state;
      }
      return {
        ...state,
        state: 'Analyzing',
        enrichmentProgress: 1,
        aiProgress: 0,
      };

    case 'UPDATE_AI_PROGRESS':
      return {
        ...state,
        aiProgress: action.payload,
      };

    case 'RECEIVE_RESULTS':
      return {
        ...state,
        state: 'Results',
        analysisResult: action.payload.result,
        sessionId: action.payload.sessionId,
        aiProgress: 1,
        error: null,
        retryCount: 0,
      };

    case 'ASK_FOLLOW_UP':
      // Can only ask follow-up from Results state
      if (state.state !== 'Results') return state;
      
      return {
        ...state,
        state: 'FollowUp',
        followUpQuestion: action.payload,
      };

    case 'HANDLE_ERROR':
      return {
        ...state,
        state: 'Error',
        error: action.payload,
      };

    case 'RETRY':
      // Retry from error state - go back to processing if we have a capture
      if (state.state === 'Error' && state.captureResult && state.error?.retryable) {
        return {
          ...state,
          state: 'Processing',
          error: null,
          retryCount: state.retryCount + 1,
          processingProgress: 0,
          enrichmentProgress: 0,
          aiProgress: 0,
        };
      }
      // Otherwise, go back to mode selection
      return {
        ...state,
        state: state.mode ? 'ModeSelected' : 'Idle',
        error: null,
        captureResult: null,
        analysisResult: null,
        retryCount: 0,
        processingProgress: 0,
        enrichmentProgress: 0,
        aiProgress: 0,
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

export function canStartAnalysis(state: MachineState): boolean {
  return state.state === 'ReadyToAnalyze' && state.captureResult !== null;
}

export function canRetry(state: MachineState): boolean {
  return (
    state.state === 'Error' &&
    state.error?.retryable === true &&
    state.retryCount < 3
  );
}

export function getStateProgress(state: MachineState): number {
  switch (state.state) {
    case 'Idle':
      return 0;
    case 'ModeSelected':
      return 5;
    case 'Capturing':
      return 10;
    case 'ReadyToAnalyze':
      return 12;
    case 'Processing':
      return 15 + (state.processingProgress * 10);
    case 'Enriching':
      return 25 + (state.enrichmentProgress * 20);
    case 'Analyzing':
      return 45 + (state.aiProgress * 50);
    case 'Results':
      return 100;
    case 'FollowUp':
      return 100; // Same as Results since we're in follow-up mode
    case 'Error':
      return 0;
    default:
      return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-Up Query Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if follow-up queries are supported in the current state.
 * Follow-up queries can be asked from Results or FollowUp states.
 * 
 * @param state - Current machine state
 * @returns True if follow-up queries are supported
 * 
 * @example
 * ```typescript
 * if (canAskFollowUp(state)) {
 *   // Show follow-up query input UI
 * }
 * ```
 */
export function canAskFollowUp(state: MachineState): boolean {
  return state.state === 'Results' || state.state === 'FollowUp';
}

/**
 * Get the session ID from the current state.
 * Session ID is available in Results and FollowUp states.
 * 
 * @param state - Current machine state
 * @returns Session ID or null if not available
 * 
 * @example
 * ```typescript
 * const sessionId = getSessionId(state);
 * if (sessionId) {
 *   const history = await getConversationHistory(sessionId);
 * }
 * ```
 */
export function getSessionId(state: MachineState): string | null {
  if (state.state === 'Results' || state.state === 'FollowUp') {
    return state.sessionId;
  }
  return null;
}

/**
 * Check if the current state has a conversation session.
 * 
 * @param state - Current machine state
 * @returns True if state has a session ID
 */
export function hasSession(state: MachineState): boolean {
  return state.sessionId !== null;
}

/**
 * Get the current follow-up question if in FollowUp state.
 * 
 * @param state - Current machine state
 * @returns Follow-up question or null
 */
export function getFollowUpQuestion(state: MachineState): string | null {
  if (state.state === 'FollowUp') {
    return state.followUpQuestion;
  }
  return null;
}
