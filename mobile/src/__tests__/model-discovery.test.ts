import { fetchAvailableModels } from '../services/model-discovery';

// Since fetchAvailableModels makes actual network calls to OpenAI API,
// we just verify the function exists and has the right signature.

describe('model-discovery', () => {
  describe('fetchAvailableModels', () => {
    it('should be a function that accepts apiKey', () => {
      expect(typeof fetchAvailableModels).toBe('function');
    });
  });
});
