/**
 * Tests for LangChain Configuration Module
 *
 * Verifies:
 * - Factory function creates chat model instances with correct parameters
 * - Configuration constants have expected values
 * - Model instances are properly configured for fishing analysis
 */

import {
  createChatModel,
  LANGCHAIN_TEMPERATURE,
  LANGCHAIN_TIMEOUT_MS,
  LANGCHAIN_MAX_TOKENS,
} from '../config/langchain';

describe('LangChain Configuration', () => {
  describe('Configuration Constants', () => {
    it('exports LANGCHAIN_TEMPERATURE with expected value', () => {
      expect(LANGCHAIN_TEMPERATURE).toBe(0.7);
    });

    it('exports LANGCHAIN_TIMEOUT_MS with expected value', () => {
      expect(LANGCHAIN_TIMEOUT_MS).toBe(120000);
    });

    it('exports LANGCHAIN_MAX_TOKENS with expected value', () => {
      expect(LANGCHAIN_MAX_TOKENS).toBe(4096);
    });
  });

  describe('createChatModel', () => {
    const testApiKey = 'sk-test-1234567890abcdef';
    const testModelName = 'gpt-4o';

    it('creates a chat model instance', async () => {
      const model = await createChatModel(testApiKey, testModelName);
      expect(model).toBeDefined();
      expect(typeof model.invoke).toBe('function');
    });

    it('creates a model with withStructuredOutput support', async () => {
      const model = await createChatModel(testApiKey, testModelName);
      expect(typeof model.withStructuredOutput).toBe('function');
    });

    it('configures model with correct model name', async () => {
      const model = await createChatModel(testApiKey, testModelName);
      expect((model as any).model).toBe(testModelName);
    });

    it('configures model with expected temperature', async () => {
      const model = await createChatModel(testApiKey, testModelName);
      expect((model as any).temperature).toBe(LANGCHAIN_TEMPERATURE);
    });

    it('configures model with expected max tokens', async () => {
      const model = await createChatModel(testApiKey, testModelName);
      expect((model as any).maxTokens).toBe(LANGCHAIN_MAX_TOKENS);
    });

    it('configures model with maxRetries set to 0', async () => {
      const model = await createChatModel(testApiKey, testModelName);
      expect((model as any).caller.maxRetries).toBe(0);
    });

    it('creates different instances for different API keys', async () => {
      const model1 = await createChatModel(testApiKey, testModelName);
      const model2 = await createChatModel('sk-test-different-key', testModelName);
      expect(model1).not.toBe(model2);
    });

    it('creates different instances for different model names', async () => {
      const model1 = await createChatModel(testApiKey, 'gpt-4o');
      const model2 = await createChatModel(testApiKey, 'gpt-4-vision-preview');
      expect(model1).not.toBe(model2);
      expect((model1 as any).model).toBe('gpt-4o');
      expect((model2 as any).model).toBe('gpt-4-vision-preview');
    });

    it('accepts empty string as API key (validation at runtime)', async () => {
      const model = await createChatModel('', testModelName);
      expect(model).toBeDefined();
    });

    it('accepts empty string as model name (validation at runtime)', async () => {
      // ChatOpenAI accepts empty model name at construction; validation happens at inference time
      const model = await createChatModel(testApiKey, '');
      expect(model).toBeDefined();
    });
  });

  describe('Integration with chat model', () => {
    it('creates model ready for vision tasks', async () => {
      const model = await createChatModel('sk-test-key', 'gpt-4o');
      expect(model).toBeDefined();
      expect((model as any).model).toBe('gpt-4o');
    });

    it('creates model with configuration suitable for fishing analysis', async () => {
      const model = await createChatModel('sk-test-key', 'gpt-4o');

      // Verify all key parameters match fishing analysis requirements
      expect((model as any).temperature).toBe(0.7);               // Balanced creativity/consistency
      expect((model as any).maxTokens).toBe(4096);                // Sufficient for detailed analysis
      expect((model as any).caller.maxRetries).toBe(0);           // App-level retry handling
      expect(LANGCHAIN_TIMEOUT_MS).toBe(120000);
    });
  });
});
