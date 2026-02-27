/**
 * Tests for LangChain Follow-Up Query Handler
 * 
 * Covers:
 * - Successful follow-up queries with history
 * - Error cases (no history, network, timeout, auth)
 * - Prompt building logic
 * - Error mapping consistency
 */

import { handleFollowUpQuestion, buildFollowUpPrompt, mapFollowUpError } from '../services/langchain-followup';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

// ============================================================================
// Mocks
// ============================================================================

// Mock LangChain modules
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn()
}));

jest.mock('../config/langchain', () => ({
  createChatModel: jest.fn()
}));

jest.mock('../services/langchain-memory', () => ({
  getConversationHistory: jest.fn()
}));

// Import mocked modules for type safety
import { ChatOpenAI } from '@langchain/openai';
import { createChatModel } from '../config/langchain';
import { getConversationHistory } from '../services/langchain-memory';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create mock conversation history
 */
function createMockHistory(): BaseMessage[] {
  return [
    new HumanMessage('Analyze this fishing spot'),
    new AIMessage(JSON.stringify({
      analysis_summary: 'Great bass fishing spot with weedline',
      zones: [
        {
          id: 'Z1',
          type: 'weedline',
          coordinates: [[0.2, 0.3], [0.4, 0.3]],
          primary_tactics: ['Texas rig', 'Swimbaits'],
          likely_species: [{ species: 'Largemouth Bass', confidence: 0.9 }]
        }
      ],
      best_time_of_day: 'Early morning',
      conditions_note: 'Target weedlines at dawn'
    }, null, 2))
  ];
}

/**
 * Create mock model with invoke method
 */
function createMockModel(responseContent: string | object) {
  const mockInvoke = jest.fn().mockResolvedValue({
    content: typeof responseContent === 'string' 
      ? responseContent 
      : JSON.stringify(responseContent)
  });
  
  return {
    invoke: mockInvoke
  };
}

// ============================================================================
// Tests: Successful Follow-Up Queries
// ============================================================================

describe('handleFollowUpQuestion - Success Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle successful follow-up query with text response', async () => {
    const mockHistory = createMockHistory();
    const mockResponse = 'For Zone Z1, I recommend using a 1/4oz Texas rigged creature bait in green pumpkin.';
    const mockModel = createMockModel(mockResponse);
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    const result = await handleFollowUpQuestion(
      'session-123',
      'What lure should I use in Zone Z1?',
      'sk-test-key',
      'gpt-4o'
    );
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toBe(mockResponse);
    }
    
    expect(getConversationHistory).toHaveBeenCalledWith('session-123');
    expect(createChatModel).toHaveBeenCalledWith('sk-test-key', 'gpt-4o');
    expect(mockModel.invoke).toHaveBeenCalledTimes(1);
  });

  test('should pass conversation history to model', async () => {
    const mockHistory = createMockHistory();
    const mockModel = createMockModel('Response');
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    await handleFollowUpQuestion(
      'session-123',
      'Follow-up question',
      'sk-test-key'
    );
    
    const invokeArgs = mockModel.invoke.mock.calls[0][0];
    
    // Should contain: system prompt + history + new question
    expect(invokeArgs).toHaveLength(mockHistory.length + 2);
    expect(invokeArgs[0]).toBeInstanceOf(HumanMessage); // System prompt
    expect(invokeArgs[invokeArgs.length - 1]).toBeInstanceOf(HumanMessage); // New question
  });

  test('should handle JSON object response content', async () => {
    const mockHistory = createMockHistory();
    const mockResponse = { text: 'Some response', metadata: { confidence: 0.9 } };
    const mockModel = createMockModel(mockResponse);
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    const result = await handleFollowUpQuestion(
      'session-123',
      'Question',
      'sk-test-key'
    );
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toBe(JSON.stringify(mockResponse));
    }
  });

  test('should use default model name when not specified', async () => {
    const mockHistory = createMockHistory();
    const mockModel = createMockModel('Response');
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    await handleFollowUpQuestion(
      'session-123',
      'Question',
      'sk-test-key'
      // No modelName provided
    );
    
    expect(createChatModel).toHaveBeenCalledWith('sk-test-key', 'gpt-4o');
  });

  test('should handle long conversation history', async () => {
    // Create 10 conversation turns
    const longHistory: BaseMessage[] = [];
    for (let i = 0; i < 10; i++) {
      longHistory.push(
        new HumanMessage(`Question ${i}`),
        new AIMessage(`Answer ${i}`)
      );
    }
    
    const mockModel = createMockModel('Response');
    
    (getConversationHistory as jest.Mock).mockResolvedValue(longHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    const result = await handleFollowUpQuestion(
      'session-123',
      'Latest question',
      'sk-test-key'
    );
    
    expect(result.success).toBe(true);
    
    const invokeArgs = mockModel.invoke.mock.calls[0][0];
    expect(invokeArgs).toHaveLength(longHistory.length + 2); // history + system + question
  });
});

// ============================================================================
// Tests: Error Cases
// ============================================================================

describe('handleFollowUpQuestion - Error Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return error when no conversation history exists', async () => {
    (getConversationHistory as jest.Mock).mockResolvedValue([]);
    
    const result = await handleFollowUpQuestion(
      'session-nonexistent',
      'Question',
      'sk-test-key'
    );
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NO_HISTORY');
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toContain('No conversation history');
    }
  });

  test('should handle network errors', async () => {
    const mockHistory = createMockHistory();
    const mockModel = {
      invoke: jest.fn().mockRejectedValue(new Error('Network error: fetch failed'))
    };
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    const result = await handleFollowUpQuestion(
      'session-123',
      'Question',
      'sk-test-key'
    );
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.retryable).toBe(true);
      expect(result.error.message).toContain('Network error');
    }
  });

  test('should handle timeout errors', async () => {
    const mockHistory = createMockHistory();
    const mockModel = {
      invoke: jest.fn().mockRejectedValue(new Error('Request timed out'))
    };
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    const result = await handleFollowUpQuestion(
      'session-123',
      'Question',
      'sk-test-key'
    );
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.error.retryable).toBe(true);
      expect(result.error.message).toContain('timed out');
    }
  });

  test('should handle authentication errors (401)', async () => {
    const mockHistory = createMockHistory();
    const mockModel = {
      invoke: jest.fn().mockRejectedValue(new Error('401 Unauthorized'))
    };
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    const result = await handleFollowUpQuestion(
      'session-123',
      'Question',
      'sk-invalid-key'
    );
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_KEY');
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toContain('Invalid API key');
    }
  });

  test('should handle rate limit errors (429)', async () => {
    const mockHistory = createMockHistory();
    const mockModel = {
      invoke: jest.fn().mockRejectedValue(new Error('429 Rate limit exceeded'))
    };
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    const result = await handleFollowUpQuestion(
      'session-123',
      'Question',
      'sk-test-key'
    );
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('RATE_LIMITED');
      expect(result.error.retryable).toBe(true);
      expect(result.error.message).toContain('Rate limit');
    }
  });

  test('should handle unknown errors', async () => {
    const mockHistory = createMockHistory();
    const mockModel = {
      invoke: jest.fn().mockRejectedValue(new Error('Something went wrong'))
    };
    
    (getConversationHistory as jest.Mock).mockResolvedValue(mockHistory);
    (createChatModel as jest.Mock).mockReturnValue(mockModel);
    
    const result = await handleFollowUpQuestion(
      'session-123',
      'Question',
      'sk-test-key'
    );
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ERROR');
      expect(result.error.retryable).toBe(true);
      expect(result.error.message).toBe('Something went wrong');
    }
  });
});

// ============================================================================
// Tests: Prompt Building
// ============================================================================

describe('buildFollowUpPrompt', () => {
  test('should return a non-empty prompt', () => {
    const prompt = buildFollowUpPrompt();
    
    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  test('should include key instructions for follow-up queries', () => {
    const prompt = buildFollowUpPrompt();
    
    // Check for key concepts
    expect(prompt.toLowerCase()).toContain('fishing');
    expect(prompt.toLowerCase()).toContain('follow-up');
    expect(prompt.toLowerCase()).toContain('previous analysis');
  });

  test('should instruct model to stay focused on fishing topics', () => {
    const prompt = buildFollowUpPrompt();
    
    expect(prompt.toLowerCase()).toContain('fishing');
    expect(prompt.toLowerCase()).toContain('tactics');
  });

  test('should include response format guidance', () => {
    const prompt = buildFollowUpPrompt();
    
    // Should guide text-only responses
    expect(prompt.toLowerCase()).toContain('response');
  });
});

// ============================================================================
// Tests: Error Mapping
// ============================================================================

describe('mapFollowUpError', () => {
  test('should map network errors correctly', () => {
    const error = new Error('Network error: fetch failed');
    const mapped = mapFollowUpError(error);
    
    expect(mapped.code).toBe('NETWORK_ERROR');
    expect(mapped.retryable).toBe(true);
    expect(mapped.message).toContain('Network error');
  });

  test('should map timeout errors correctly', () => {
    const error = new Error('Request timed out');
    const mapped = mapFollowUpError(error);
    
    expect(mapped.code).toBe('TIMEOUT');
    expect(mapped.retryable).toBe(true);
    expect(mapped.message).toContain('timed out');
  });

  test('should map authentication errors correctly', () => {
    const error = new Error('401 Unauthorized');
    const mapped = mapFollowUpError(error);
    
    expect(mapped.code).toBe('INVALID_KEY');
    expect(mapped.retryable).toBe(false);
    expect(mapped.message).toContain('Invalid API key');
  });

  test('should map rate limit errors correctly', () => {
    const error = new Error('429 Rate limit exceeded');
    const mapped = mapFollowUpError(error);
    
    expect(mapped.code).toBe('RATE_LIMITED');
    expect(mapped.retryable).toBe(true);
    expect(mapped.message).toContain('Rate limit');
  });

  test('should map unknown errors with default retryable=true', () => {
    const error = new Error('Unexpected error');
    const mapped = mapFollowUpError(error);
    
    expect(mapped.code).toBe('UNKNOWN_ERROR');
    expect(mapped.retryable).toBe(true);
    expect(mapped.message).toBe('Unexpected error');
  });

  test('should handle non-Error objects', () => {
    const error = 'String error message';
    const mapped = mapFollowUpError(error);
    
    expect(mapped.code).toBe('UNKNOWN_ERROR');
    expect(mapped.retryable).toBe(true);
  });

  test('should include error details in mapped result', () => {
    const error = new Error('Test error');
    const mapped = mapFollowUpError(error);
    
    expect(mapped.details).toBe(error);
  });

  test('should handle error with no message', () => {
    const error = {};
    const mapped = mapFollowUpError(error);
    
    expect(mapped.code).toBe('UNKNOWN_ERROR');
    expect(mapped.message).toBeTruthy();
  });
});
