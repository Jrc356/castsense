import {
  appReducer,
  initialState,
  actions,
  type MachineState,
} from '../state/machine';

describe('State Machine - Model Selection', () => {
  describe('SELECT_MODEL action', () => {
    it('should update selectedModel in state', () => {
      const testModel = 'gpt-4-turbo';
      const action = actions.selectModel(testModel);
      const newState = appReducer(initialState, action);

      expect(newState.selectedModel).toBe(testModel);
    });

    it('should preserve other state properties', () => {
      const startState: MachineState = {
        ...initialState,
        state: 'ModeSelected',
        mode: 'general',
      };

      const action = actions.selectModel('gpt-4o-mini');
      const newState = appReducer(startState, action);

      expect(newState.selectedModel).toBe('gpt-4o-mini');
      expect(newState.state).toBe('ModeSelected');
      expect(newState.mode).toBe('general');
    });

    it('should allow changing model multiple times', () => {
      let state = initialState;

      state = appReducer(state, actions.selectModel('gpt-4o'));
      expect(state.selectedModel).toBe('gpt-4o');

      state = appReducer(state, actions.selectModel('gpt-4-turbo'));
      expect(state.selectedModel).toBe('gpt-4-turbo');

      state = appReducer(state, actions.selectModel('gpt-4o-mini'));
      expect(state.selectedModel).toBe('gpt-4o-mini');
    });
  });

  describe('SET_AVAILABLE_MODELS action', () => {
    it('should update availableModels in state', () => {
      const testModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini'];
      const action = actions.setAvailableModels(testModels);
      const newState = appReducer(initialState, action);

      expect(newState.availableModels).toEqual(testModels);
    });

    it('should handle empty models list', () => {
      const action = actions.setAvailableModels([]);
      const newState = appReducer(initialState, action);

      expect(newState.availableModels).toEqual([]);
    });

    it('should replace previous models list', () => {
      let state = initialState;

      state = appReducer(state, actions.setAvailableModels(['gpt-4o', 'gpt-4-turbo']));
      expect(state.availableModels).toEqual(['gpt-4o', 'gpt-4-turbo']);

      state = appReducer(state, actions.setAvailableModels(['gpt-4o-mini']));
      expect(state.availableModels).toEqual(['gpt-4o-mini']);
    });

    it('should preserve other state properties', () => {
      const startState: MachineState = {
        ...initialState,
        state: 'ModeSelected',
        selectedModel: 'gpt-4o',
      };

      const action = actions.setAvailableModels(['gpt-4o', 'gpt-4-turbo']);
      const newState = appReducer(startState, action);

      expect(newState.availableModels).toEqual(['gpt-4o', 'gpt-4-turbo']);
      expect(newState.selectedModel).toBe('gpt-4o');
      expect(newState.state).toBe('ModeSelected');
    });
  });

  describe('Model selection flow', () => {
    it('should support full model selection flow', () => {
      let state = initialState;

      // Set available models
      state = appReducer(state, actions.setAvailableModels(['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini']));
      expect(state.availableModels).toEqual(['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini']);

      // Select a model
      state = appReducer(state, actions.selectModel('gpt-4-turbo'));
      expect(state.selectedModel).toBe('gpt-4-turbo');

      // Continue with other actions
      state = appReducer(state, actions.selectMode('general'));
      expect(state.mode).toBe('general');
      expect(state.selectedModel).toBe('gpt-4-turbo'); // Model selection preserved
    });

    it('should preserve model selection through state transitions', () => {
      let state = initialState;

      // Set model early
      state = appReducer(state, actions.selectModel('gpt-4o'));

      // Go through various state transitions
      state = appReducer(state, actions.selectMode('specific', 'Bass'));
      state = appReducer(state, actions.startCapture());
      state = appReducer(state, actions.completeCapture({
        uri: 'file:///test.jpg',
        mimeType: 'image/jpeg',
      }));

      // Model should still be selected
      expect(state.selectedModel).toBe('gpt-4o');
    });
  });

  describe('Initial state', () => {
    it('should initialize with null selectedModel', () => {
      expect(initialState.selectedModel).toBeNull();
    });

    it('should initialize with empty availableModels', () => {
      expect(initialState.availableModels).toEqual([]);
    });
  });
});
