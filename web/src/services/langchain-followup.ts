/**
 * LangChain Follow-Up Query Handler
 * 
 * Handles follow-up questions about previous analysis results using conversation memory.
 * Enables contextual Q&A without re-analyzing images.
 * 
 * Flow:
 * 1. Retrieve conversation history from memory
 * 2. Build follow-up prompt with context
 * 3. Call LangChain model with history + new question
 * 4. Return text response (not structured CastSenseResult)
 * 
 * Example Use Cases:
 * - "What lure should I use in Zone Z1?"
 * - "Tell me more about the weedline tactics"
 * - "What's the best time to fish this spot?"
 * - "Can you recommend alternative baits?"
 */

import { HumanMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { createChatModel } from '../config/langchain';
import { getConversationHistory } from './langchain-memory';

// ============================================================================
// Types
// ============================================================================

/**
 * Follow-up query result (success case)
 */
export interface FollowUpSuccess {
  success: true;
  response: string;
}

/**
 * Follow-up query result (error case)
 */
export interface FollowUpError {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: any;
  };
}

/**
 * Follow-up query result (union type)
 */
export type FollowUpResult = FollowUpSuccess | FollowUpError;

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handle a follow-up question about a previous analysis.
 * 
 * Uses conversation memory to provide context-aware responses without
 * re-analyzing the image.
 * 
 * @param sessionId - Conversation session ID (must have existing history)
 * @param question - User's follow-up question
 * @param apiKey - OpenAI API key
 * @param modelName - Model to use (default: gpt-4o)
 * @returns Follow-up result with response text or error
 * 
 * @example
 * ```typescript
 * const result = await handleFollowUpQuestion(
 *   'session-123',
 *   'What lure should I use in Zone Z1?',
 *   userApiKey,
 *   'gpt-4o'
 * );
 * 
 * if (result.success) {
 *   console.log(result.response);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function handleFollowUpQuestion(
  sessionId: string,
  question: string,
  apiKey: string,
  modelName: string = 'gpt-4o'
): Promise<FollowUpResult> {
  console.log(`[LangChain Follow-Up] Handling question for session: ${sessionId}`);
  console.log(`[LangChain Follow-Up] Question: ${question}`);
  
  try {
    // 1. Retrieve conversation history
    const history = await getConversationHistory(sessionId);
    
    if (history.length === 0) {
      console.error(`[LangChain Follow-Up] No history found for session: ${sessionId}`);
      return {
        success: false,
        error: {
          code: 'NO_HISTORY',
          message: 'No conversation history found for this session. Please analyze an image first.',
          retryable: false
        }
      };
    }
    
    console.log(`[LangChain Follow-Up] Retrieved ${history.length} messages from history`);
    
    // 2. Build prompt with history
    const systemPrompt = buildFollowUpPrompt();
    
    // 3. Create messages array: system + history + new question
    const messages: BaseMessage[] = [
      new HumanMessage(systemPrompt),
      ...history,
      new HumanMessage(question)
    ];
    
    console.log(`[LangChain Follow-Up] Invoking model: ${modelName}`);
    
    // 4. Call model
    const model = createChatModel(apiKey, modelName);
    const response = await model.invoke(messages);
    
    // 5. Extract response text
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
    
    console.log(`[LangChain Follow-Up] Got response (${responseText.length} chars)`);
    
    return {
      success: true,
      response: responseText
    };
    
  } catch (error) {
    console.error(`[LangChain Follow-Up] Error:`, error);
    return {
      success: false,
      error: mapFollowUpError(error)
    };
  }
}

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Build system prompt for follow-up questions.
 * 
 * Instructs the model to:
 * - Answer based on previous analysis context
 * - Provide concise, actionable fishing advice
 * - Stay focused on fishing topics
 * - Clarify tactics, lures, timing, conditions
 * 
 * @returns System prompt for follow-up handler
 */
export function buildFollowUpPrompt(): string {
  return `You are a fishing advisor AI assistant helping with follow-up questions about a fishing spot analysis.

The user has already received a detailed analysis with zones, tactics, and species recommendations. They may now ask follow-up questions to:
- Clarify tactics or techniques
- Ask about specific lures or baits
- Request alternative approaches
- Get more detail about zones or species
- Ask about timing or conditions

**Your Task:**
Provide concise, helpful answers based on the previous analysis context. Stay focused on fishing advice.

**Guidelines:**
- Reference zones, tactics, and species from the previous analysis
- Be specific and actionable (e.g., "For Zone Z1, use a 1/4oz jig with a crawfish trailer")
- If the question is unrelated to fishing or the analysis, politely redirect back to fishing topics
- Keep responses conversational but professional
- If you don't have enough context, ask a clarifying question

**Response Format:**
Respond in plain text (not JSON). Keep answers under 200 words unless detail is specifically requested.`;
}

// ============================================================================
// Error Mapper
// ============================================================================

/**
 * Map errors to consistent format for follow-up queries.
 * 
 * Categorizes errors by type:
 * - NETWORK_ERROR: Connection/fetch failures (retryable)
 * - TIMEOUT: Request timeout (retryable)
 * - INVALID_KEY: Authentication failure (not retryable)
 * - RATE_LIMITED: Rate limit exceeded (retryable)
 * - UNKNOWN_ERROR: Other errors (retryable)
 * 
 * @param error - Error object from LangChain or fetch
 * @returns Structured error object
 */
export function mapFollowUpError(error: any): {
  code: string;
  message: string;
  retryable: boolean;
  details?: any;
} {
  const errorMessage = error?.message || String(error);
  const errorString = errorMessage.toLowerCase();
  
  // Network errors
  if (errorString.includes('network') || errorString.includes('fetch') || errorString.includes('econnrefused')) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network error during follow-up query. Check your connection.',
      retryable: true,
      details: error
    };
  }
  
  // Timeout errors
  if (errorString.includes('timeout') || errorString.includes('timed out')) {
    return {
      code: 'TIMEOUT',
      message: 'Follow-up query timed out. Please try again.',
      retryable: true,
      details: error
    };
  }
  
  // Authentication errors
  if (errorString.includes('401') || errorString.includes('unauthorized') || errorString.includes('invalid api key')) {
    return {
      code: 'INVALID_KEY',
      message: 'Invalid API key. Please check your OpenAI API key.',
      retryable: false,
      details: error
    };
  }
  
  // Rate limit errors
  if (errorString.includes('429') || errorString.includes('rate limit')) {
    return {
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded. Please wait and try again.',
      retryable: true,
      details: error
    };
  }
  
  // Unknown errors (default to retryable)
  return {
    code: 'UNKNOWN_ERROR',
    message: errorMessage || 'An unknown error occurred',
    retryable: true,
    details: error
  };
}
