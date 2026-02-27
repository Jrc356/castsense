/**
 * State Machine Tests
 * 
 * Tests for the CastSense state machine reducer and transitions
 */

import {
  appReducer,
  initialState,
  actions,
  canStartAnalysis,
  type MachineState,
} from '../state/machine';

describe('State Machine', () => {
  describe('Mode Selection', () => {
    it('should transition from Idle to ModeSelected', () => {
      const state = appReducer(
        initialState,
        actions.selectMode('general')
      );
      expect(state.state).toBe('ModeSelected');
      expect(state.mode).toBe('general');
    });

    it('should preserve ReadyToAnalyze state when updating mode after capture', () => {
      // Simulate: select mode -> capture -> complete capture -> update mode
      let state: MachineState = initialState;
      
      // Select mode
      state = appReducer(state, actions.selectMode('general'));
      expect(state.state).toBe('ModeSelected');
      
      // Start capture
      state = appReducer(state, actions.startCapture());
      expect(state.state).toBe('Capturing');
      
      // Complete capture
      state = appReducer(state, actions.completeCapture({
        uri: 'file://test.jpg',
        width: 1920,
        height: 1080,
        sizeBytes: 12345,
        mimeType: 'image/jpeg',
      }));
      expect(state.state).toBe('ReadyToAnalyze');
      expect(state.captureResult).toBeTruthy();
      
      // Update mode/species (this was causing the bug)
      state = appReducer(state, actions.selectMode('specific', 'Bass'));
      expect(state.state).toBe('ReadyToAnalyze'); // Should preserve ReadyToAnalyze!
      expect(state.mode).toBe('specific');
      expect(state.targetSpecies).toBe('Bass');
      
      // Now startAnalysis should work
      expect(canStartAnalysis(state)).toBe(true);
      state = appReducer(state, actions.startAnalysis());
      expect(state.state).toBe('Processing');
    });
  });

  describe('Capture Flow', () => {
    it('should transition through capture states correctly', () => {
      let state: MachineState = initialState;
      
      // Select mode
      state = appReducer(state, actions.selectMode('general'));
      expect(state.state).toBe('ModeSelected');
      
      // Start capture
      state = appReducer(state, actions.startCapture());
      expect(state.state).toBe('Capturing');
      
      // Complete capture
      const captureResult = {
        uri: 'file://test.jpg',
        width: 1920,
        height: 1080,
        sizeBytes: 12345,
        mimeType: 'image/jpeg',
      };
      state = appReducer(state, actions.completeCapture(captureResult));
      expect(state.state).toBe('ReadyToAnalyze');
      expect(state.captureResult).toEqual(captureResult);
    });
  });

  describe('Analysis Flow', () => {
    it('should prevent analysis without capture', () => {
      let state: MachineState = initialState;
      
      // Select mode but don't capture
      state = appReducer(state, actions.selectMode('general'));
      expect(state.state).toBe('ModeSelected');
      
      // Try to start analysis (should fail)
      state = appReducer(state, actions.startAnalysis());
      expect(state.state).toBe('ModeSelected'); // Should stay in ModeSelected
    });

    it('should transition through analysis pipeline', () => {
      let state: MachineState = initialState;
      
      // Setup: select mode, capture, complete capture
      state = appReducer(state, actions.selectMode('general'));
      state = appReducer(state, actions.startCapture());
      state = appReducer(state, actions.completeCapture({
        uri: 'file://test.jpg',
        width: 1920,
        height: 1080,
        sizeBytes: 12345,
        mimeType: 'image/jpeg',
      }));
      expect(state.state).toBe('ReadyToAnalyze');
      
      // Start analysis
      state = appReducer(state, actions.startAnalysis());
      expect(state.state).toBe('Processing');
      expect(state.processingProgress).toBe(0);
      
      // Update processing progress
      state = appReducer(state, actions.updateProcessingProgress(0.5));
      expect(state.processingProgress).toBe(0.5);
      
      // Move to enrichment
      state = appReducer(state, actions.startEnrichment());
      expect(state.state).toBe('Enriching');
      expect(state.processingProgress).toBe(1);
      expect(state.enrichmentProgress).toBe(0);
      
      // Update enrichment progress
      state = appReducer(state, actions.updateEnrichmentProgress(0.5));
      expect(state.enrichmentProgress).toBe(0.5);
      
      // Move to AI analysis
      state = appReducer(state, actions.startAIAnalysis());
      expect(state.state).toBe('Analyzing');
      expect(state.enrichmentProgress).toBe(1);
      expect(state.aiProgress).toBe(0);
      
      // Update AI progress
      state = appReducer(state, actions.updateAIProgress(0.5));
      expect(state.aiProgress).toBe(0.5);
      
      // Receive results
      const mockResult = {
        result: { test: 'data' },
        enrichment: {},
        validation: {},
        model: 'gpt-4-vision-preview',
        timings: {
          processing_ms: 100,
          enrichment_ms: 200,
          ai_ms: 300,
          validation_ms: 50,
          total_ms: 650,
        },
      };
      state = appReducer(state, actions.receiveResults(mockResult, 'test-session-123'));
      expect(state.state).toBe('Results');
      expect(state.analysisResult).toEqual(mockResult);
      expect(state.sessionId).toBe('test-session-123');
      expect(state.aiProgress).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors and allow retry', () => {
      let state: MachineState = initialState;
      
      // Setup: get to Processing state
      state = appReducer(state, actions.selectMode('general'));
      state = appReducer(state, actions.startCapture());
      state = appReducer(state, actions.completeCapture({
        uri: 'file://test.jpg',
        width: 1920,
        height: 1080,
        sizeBytes: 12345,
        mimeType: 'image/jpeg',
      }));
      state = appReducer(state, actions.startAnalysis());
      expect(state.state).toBe('Processing');
      
      // Handle error
      const error = {
        code: 'AI_TIMEOUT',
        message: 'Analysis timeout',
        retryable: true,
      };
      state = appReducer(state, actions.handleError(error));
      expect(state.state).toBe('Error');
      expect(state.error).toEqual(error);
      
      // Retry
      state = appReducer(state, actions.retry());
      expect(state.state).toBe('Processing');
      expect(state.error).toBe(null);
      expect(state.retryCount).toBe(1);
    });
  });
});
