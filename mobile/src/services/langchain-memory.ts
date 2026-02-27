/**
 * LangChain Conversation Memory (Mobile)
 * 
 * Provides session-based conversation memory using in-memory chat history.
 * Enables follow-up queries by maintaining analysis history within sessions.
 * 
 * Session Lifecycle:
 * 1. Create session ID when analysis starts
 * 2. Store analysis results + user queries in memory
 * 3. Retrieve history when processing follow-up questions
 * 4. Clear session when user returns to home or starts fresh
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { CastSenseResult } from './langchain-parsers';

// ============================================================================
// Types
// ============================================================================

/**
 * Simple in-memory chat history store for a single session.
 * Implements message storage without external dependencies.
 */
class InMemoryChatHistory {
  private messages: BaseMessage[] = [];

  async addMessage(message: BaseMessage): Promise<void> {
    this.messages.push(message);
  }

  async addMessages(messages: BaseMessage[]): Promise<void> {
    this.messages.push(...messages);
  }

  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }

  async clear(): Promise<void> {
    this.messages = [];
  }
}

/**
 * Session-based memory store.
 * Each session ID maps to its own InMemoryChatHistory instance.
 */
const memoryStore = new Map<string, InMemoryChatHistory>();

/**
 * Memory statistics for debugging
 */
export interface MemoryStats {
  /** Number of active sessions */
  sessionCount: number;
  
  /** Session IDs currently in memory */
  sessionIds: string[];
  
  /** Message count per session */
  messageCounts: Record<string, number>;
}

// ============================================================================
// Session ID Management
// ============================================================================

/**
 * Generate a unique session ID.
 * 
 * Uses timestamp + random suffix for uniqueness without requiring external dependencies.
 * Format: `{timestamp_base36}-{random_base36}` (e.g., "l3x2n9-8h4k1p")
 * 
 * @returns Unique session identifier
 * 
 * @example
 * ```typescript
 * const sessionId = createSessionId(); // "l3x2n9-8h4k1p"
 * ```
 */
export function createSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

// ============================================================================
// Memory Management
// ============================================================================

/**
 * Create or retrieve conversation memory for a session.
 * 
 * Creates a new InMemoryChatHistory instance if session doesn't exist.
 * 
 * @param sessionId - Unique session identifier
 * @returns InMemoryChatHistory instance for the session
 * 
 * @example
 * ```typescript
 * const memory = createConversationMemory('session-123');
 * await memory.addMessage(new HumanMessage('User question'));
 * ```
 */
export function createConversationMemory(sessionId: string): InMemoryChatHistory {
  if (!memoryStore.has(sessionId)) {
    console.log(`[LangChain Memory] Creating new memory for session: ${sessionId}`);
    memoryStore.set(sessionId, new InMemoryChatHistory());
  }
  
  return memoryStore.get(sessionId)!;
}

/**
 * Add a conversation turn to memory.
 * 
 * Stores both user message and AI response in the session's chat history.
 * The AI response is serialized to JSON for consistent storage format.
 * 
 * @param sessionId - Session identifier
 * @param userMessage - User's question or query
 * @param aiResponse - Validated CastSense AI result
 * 
 * @example
 * ```typescript
 * await addToMemory('session-123', 
 *   'What lure should I use?', 
 *   castSenseResult
 * );
 * ```
 */
export async function addToMemory(
  sessionId: string,
  userMessage: string,
  aiResponse: CastSenseResult
): Promise<void> {
  console.log(`[LangChain Memory] Adding conversation turn to session: ${sessionId}`);
  
  const memory = createConversationMemory(sessionId);
  
  // Add messages to chat history
  await memory.addMessages([
    new HumanMessage(userMessage),
    new AIMessage(JSON.stringify(aiResponse, null, 2))
  ]);
  
  console.log(`[LangChain Memory] Memory updated. Total messages: ${(await memory.getMessages()).length}`);
}

/**
 * Retrieve conversation history for a session.
 * 
 * Returns all messages (user + AI) in chronological order.
 * Returns empty array if session doesn't exist or has no history.
 * 
 * @param sessionId - Session identifier
 * @returns Array of messages (HumanMessage and AIMessage)
 * 
 * @example
 * ```typescript
 * const history = await getConversationHistory('session-123');
 * console.log(`Session has ${history.length} messages`);
 * ```
 */
export async function getConversationHistory(sessionId: string): Promise<BaseMessage[]> {
  const memory = memoryStore.get(sessionId);
  
  if (!memory) {
    console.log(`[LangChain Memory] No memory found for session: ${sessionId}`);
    return [];
  }
  
  const messages = await memory.getMessages();
  console.log(`[LangChain Memory] Retrieved ${messages.length} messages for session: ${sessionId}`);
  
  return messages;
}

/**
 * Check if a session has conversation history.
 * 
 * Useful for determining if follow-up queries are supported.
 * 
 * @param sessionId - Session identifier
 * @returns True if session exists and has messages
 * 
 * @example
 * ```typescript
 * if (await hasHistory('session-123')) {
 *   // Enable follow-up query UI
 * }
 * ```
 */
export async function hasHistory(sessionId: string): Promise<boolean> {
  const memory = memoryStore.get(sessionId);
  if (!memory) return false;
  
  const messages = await memory.getMessages();
  return messages.length > 0;
}

/**
 * Get message count for a session.
 * 
 * @param sessionId - Session identifier
 * @returns Number of messages in session (0 if session doesn't exist)
 */
export async function getMessageCount(sessionId: string): Promise<number> {
  const memory = memoryStore.get(sessionId);
  if (!memory) return 0;
  
  const messages = await memory.getMessages();
  return messages.length;
}

// ============================================================================
// Memory Cleanup
// ============================================================================

/**
 * Clear memory for a specific session.
 * 
 * Removes the session from the store entirely.
 * Call this when user starts a new analysis or returns to home screen.
 * 
 * @param sessionId - Session identifier to clear
 * 
 * @example
 * ```typescript
 * // User navigates home - clear current session
 * clearMemory(currentSessionId);
 * ```
 */
export function clearMemory(sessionId: string): void {
  const existed = memoryStore.delete(sessionId);
  
  if (existed) {
    console.log(`[LangChain Memory] Cleared memory for session: ${sessionId}`);
  } else {
    console.log(`[LangChain Memory] No memory to clear for session: ${sessionId}`);
  }
}

/**
 * Clear all conversation memory.
 * 
 * Wipes all sessions from the store.
 * Useful for testing, logout, or memory pressure situations.
 * 
 * @example
 * ```typescript
 * // User logs out - clear all memory
 * clearAllMemory();
 * ```
 */
export function clearAllMemory(): void {
  const count = memoryStore.size;
  memoryStore.clear();
  
  console.log(`[LangChain Memory] Cleared all memory (${count} sessions)`);
}

/**
 * Get memory statistics for debugging.
 * 
 * @returns Statistics about active sessions and message counts
 * 
 * @example
 * ```typescript
 * const stats = await getMemoryStats();
 * console.log(`Active sessions: ${stats.sessionCount}`);
 * ```
 */
export async function getMemoryStats(): Promise<MemoryStats> {
  const sessionIds = Array.from(memoryStore.keys());
  const messageCounts: Record<string, number> = {};
  
  for (const sessionId of sessionIds) {
    messageCounts[sessionId] = await getMessageCount(sessionId);
  }
  
  return {
    sessionCount: sessionIds.length,
    sessionIds,
    messageCounts
  };
}
