/**
 * LangChain.js Compatibility Test for React Native
 * 
 * Verifies that LangChain packages can be imported and instantiated
 * in the React Native environment without errors.
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';

describe('LangChain.js Compatibility', () => {
  it('should import and use @langchain/core', async () => {
    const prompt = PromptTemplate.fromTemplate('Hello {name}!');
    expect(prompt).toBeDefined();
    
    const formatted = await prompt.format({ name: 'World' });
    expect(formatted).toBe('Hello World!');
  });

  it('should import and instantiate ChatOpenAI from @langchain/openai', () => {
    // Just verify we can instantiate the class
    const model = new ChatOpenAI({
      openAIApiKey: 'test-key-for-instantiation',
      temperature: 0,
    });
    
    expect(model).toBeDefined();
    expect(model.temperature).toBe(0);
  });

  it('should have required global APIs available', () => {
    // Check for APIs that LangChain might need
    expect(typeof TextEncoder).toBe('function');
    expect(typeof TextDecoder).toBe('function');
    expect(typeof URL).toBe('function');
    expect(typeof crypto).not.toBe('undefined');
    expect(typeof crypto.getRandomValues).toBe('function');
  });
});
