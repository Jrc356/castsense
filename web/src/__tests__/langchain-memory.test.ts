/**
 * Tests for LangChain Conversation Memory
 * 
 * Verifies session management, message storage/retrieval, and memory cleanup.
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import {
  createSessionId,
  createConversationMemory,
  addToMemory,
  getConversationHistory,
  hasHistory,
  getMessageCount,
  clearMemory,
  clearAllMemory,
  getMemoryStats
} from '../services/langchain-memory';
import type { CastSenseResult } from '../services/langchain-parsers';

// ============================================================================
// Mock Data
// ============================================================================

const mockCastSenseResult: CastSenseResult = {
  mode: 'general',
  likely_species: [
    { species: 'Largemouth Bass', confidence: 0.85 },
    { species: 'Bluegill', confidence: 0.65 }
  ],
  analysis_frame: {
    type: 'photo',
    width_px: 1024,
    height_px: 768
  },
  zones: [
    {
      zone_id: 'A',
      label: 'Primary',
      confidence: 0.9,
      target_species: 'Largemouth Bass',
      polygon: [[0.2, 0.3], [0.5, 0.3], [0.5, 0.7], [0.2, 0.7]],
      cast_arrow: {
        start: [0.1, 0.5],
        end: [0.35, 0.5]
      },
      style: {
        priority: 1,
        hint: 'cover'
      }
    }
  ],
  tactics: [
    {
      zone_id: 'A',
      recommended_rig: 'Texas-rigged soft plastic',
      alternate_rigs: ['Jig', 'Spinnerbait'],
      target_depth: '3-6 feet',
      retrieve_style: 'Slow drag with pauses',
      cadence: '2-3 second pauses',
      cast_count_suggestion: '5-7 casts',
      why_this_zone_works: ['Heavy cover', 'Good depth', 'Likely ambush point'],
      steps: ['Cast past the structure', 'Let the lure settle', 'Drag slowly along bottom']
    }
  ],
  conditions_summary: ['Overcast conditions', 'Moderate wind'],
  plan_summary: ['Target the main structure first', 'Work the edges methodically'],
  explainability: {
    scene_observations: ['Lily pads visible', 'Shade from trees'],
    assumptions: ['Bass are likely holding in heavy cover']
  }
};

// ============================================================================
// Test Suite Setup
// ============================================================================

describe('LangChain Memory Service', () => {
  // Clean up memory before each test
  beforeEach(() => {
    clearAllMemory();
  });

  // Clean up memory after all tests
  afterAll(() => {
    clearAllMemory();
  });

  // ==========================================================================
  // Session ID Generation
  // ==========================================================================

  describe('createSessionId', () => {
    test('should generate unique session IDs', () => {
      const id1 = createSessionId();
      const id2 = createSessionId();
      const id3 = createSessionId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id3).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    test('should generate session IDs in expected format', () => {
      const sessionId = createSessionId();
      
      // Format: {timestamp_base36}-{random_base36}
      expect(sessionId).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
      expect(sessionId.split('-')).toHaveLength(2);
    });

    test('should generate IDs with reasonable length', () => {
      const sessionId = createSessionId();
      
      // Timestamp (base36) + hyphen + random (6 chars) = ~14-20 chars
      expect(sessionId.length).toBeGreaterThan(10);
      expect(sessionId.length).toBeLessThan(30);
    });
  });

  // ==========================================================================
  // Memory Creation
  // ==========================================================================

  describe('createConversationMemory', () => {
    test('should create new memory for new session', async () => {
      const sessionId = 'test-session-001';
      const memory = createConversationMemory(sessionId);

      expect(memory).toBeDefined();
      // Verify memory has required methods
      expect(typeof memory.addMessage).toBe('function');
      expect(typeof memory.addMessages).toBe('function');
      expect(typeof memory.getMessages).toBe('function');
      
      // Verify its starts empty
      const messages = await memory.getMessages();
      expect(messages).toHaveLength(0);
    });

    test('should return existing memory for known session', () => {
      const sessionId = 'test-session-002';
      
      const memory1 = createConversationMemory(sessionId);
      const memory2 = createConversationMemory(sessionId);

      expect(memory1).toBe(memory2); // Same instance
    });

    test('should create separate memories for different sessions', () => {
      const sessionId1 = 'session-a';
      const sessionId2 = 'session-b';

      const memory1 = createConversationMemory(sessionId1);
      const memory2 = createConversationMemory(sessionId2);

      expect(memory1).not.toBe(memory2);
    });
  });

  // ==========================================================================
  // Adding Messages to Memory
  // ==========================================================================

  describe('addToMemory', () => {
    test('should add user message and AI response to memory', async () => {
      const sessionId = 'test-session-003';
      const userMessage = 'What lure should I use here?';

      await addToMemory(sessionId, userMessage, mockCastSenseResult);

      const history = await getConversationHistory(sessionId);
      expect(history).toHaveLength(2);
      
      // First message is HumanMessage
      expect(history[0]).toBeInstanceOf(HumanMessage);
      expect(history[0].content).toBe(userMessage);
      
      // Second message is AIMessage with JSON result
      expect(history[1]).toBeInstanceOf(AIMessage);
      expect(history[1].content).toContain('Largemouth Bass');
      expect(history[1].content).toContain('"zone_id": "A"');
    });

    test('should accumulate multiple conversation turns', async () => {
      const sessionId = 'test-session-004';

      // First turn
      await addToMemory(sessionId, 'First question', mockCastSenseResult);
      
      // Second turn
      await addToMemory(sessionId, 'Second question', mockCastSenseResult);

      const history = await getConversationHistory(sessionId);
      expect(history).toHaveLength(4); // 2 turns = 4 messages
      
      expect(history[0].content).toBe('First question');
      expect(history[2].content).toBe('Second question');
    });

    test('should serialize AI response as formatted JSON', async () => {
      const sessionId = 'test-session-005';

      await addToMemory(sessionId, 'Test question', mockCastSenseResult);

      const history = await getConversationHistory(sessionId);
      const aiMessage = history[1];
      
      // Should be formatted JSON with indentation
      expect(aiMessage.content).toContain('\n');
      expect(aiMessage.content).toMatch(/"mode":\s+"general"/);
      
      // Should be valid JSON
      const parsed = JSON.parse(aiMessage.content as string);
      expect(parsed.mode).toBe('general');
      expect(parsed.zones).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Retrieving Conversation History
  // ==========================================================================

  describe('getConversationHistory', () => {
    test('should return empty array for non-existent session', async () => {
      const history = await getConversationHistory('non-existent-session');
      
      expect(history).toEqual([]);
    });

    test('should return all messages in chronological order', async () => {
      const sessionId = 'test-session-006';

      await addToMemory(sessionId, 'First', mockCastSenseResult);
      await addToMemory(sessionId, 'Second', mockCastSenseResult);
      await addToMemory(sessionId, 'Third', mockCastSenseResult);

      const history = await getConversationHistory(sessionId);
      
      expect(history).toHaveLength(6);
      expect(history[0].content).toBe('First');
      expect(history[2].content).toBe('Second');
      expect(history[4].content).toBe('Third');
    });

    test('should return BaseMessage objects with correct types', async () => {
      const sessionId = 'test-session-007';

      await addToMemory(sessionId, 'Question', mockCastSenseResult);

      const history = await getConversationHistory(sessionId);
      
      expect(history[0]).toHaveProperty('content');
      expect(history[0]).toBeInstanceOf(HumanMessage);
      expect(history[1]).toBeInstanceOf(AIMessage);
    });
  });

  // ==========================================================================
  // History Status Checks
  // ==========================================================================

  describe('hasHistory', () => {
    test('should return false for non-existent session', async () => {
      const result = await hasHistory('non-existent');
      
      expect(result).toBe(false);
    });

    test('should return false for empty session', async () => {
      const sessionId = 'test-session-008';
      createConversationMemory(sessionId); // Create but don't add messages

      const result = await hasHistory(sessionId);
      
      expect(result).toBe(false);
    });

    test('should return true for session with messages', async () => {
      const sessionId = 'test-session-009';

      await addToMemory(sessionId, 'Test', mockCastSenseResult);

      const result = await hasHistory(sessionId);
      
      expect(result).toBe(true);
    });
  });

  describe('getMessageCount', () => {
    test('should return 0 for non-existent session', async () => {
      const count = await getMessageCount('non-existent');
      
      expect(count).toBe(0);
    });

    test('should return 0 for empty session', async () => {
      const sessionId = 'test-session-010';
      createConversationMemory(sessionId);

      const count = await getMessageCount(sessionId);
      
      expect(count).toBe(0);
    });

    test('should return correct message count', async () => {
      const sessionId = 'test-session-011';

      await addToMemory(sessionId, 'Q1', mockCastSenseResult);
      expect(await getMessageCount(sessionId)).toBe(2);

      await addToMemory(sessionId, 'Q2', mockCastSenseResult);
      expect(await getMessageCount(sessionId)).toBe(4);

      await addToMemory(sessionId, 'Q3', mockCastSenseResult);
      expect(await getMessageCount(sessionId)).toBe(6);
    });
  });

  // ==========================================================================
  // Session Isolation
  // ==========================================================================

  describe('Session Isolation', () => {
    test('should keep sessions completely separate', async () => {
      const session1 = 'session-alpha';
      const session2 = 'session-beta';

      await addToMemory(session1, 'Alpha question', mockCastSenseResult);
      await addToMemory(session2, 'Beta question', mockCastSenseResult);

      const history1 = await getConversationHistory(session1);
      const history2 = await getConversationHistory(session2);

      expect(history1).toHaveLength(2);
      expect(history2).toHaveLength(2);
      expect(history1[0].content).toBe('Alpha question');
      expect(history2[0].content).toBe('Beta question');
    });

    test('should not affect other sessions when adding to one', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      await addToMemory(session1, 'First message', mockCastSenseResult);
      
      const countBefore = await getMessageCount(session2);
      
      await addToMemory(session1, 'Second message', mockCastSenseResult);
      
      const countAfter = await getMessageCount(session2);

      expect(countBefore).toBe(0);
      expect(countAfter).toBe(0);
    });
  });

  // ==========================================================================
  // Memory Cleanup
  // ==========================================================================

  describe('clearMemory', () => {
    test('should remove specific session memory', async () => {
      const sessionId = 'test-session-012';

      await addToMemory(sessionId, 'Test', mockCastSenseResult);
      expect(await hasHistory(sessionId)).toBe(true);

      clearMemory(sessionId);

      expect(await hasHistory(sessionId)).toBe(false);
      expect(await getConversationHistory(sessionId)).toEqual([]);
    });

    test('should not affect other sessions when clearing one', async () => {
      const session1 = 'clear-test-1';
      const session2 = 'clear-test-2';

      await addToMemory(session1, 'Message 1', mockCastSenseResult);
      await addToMemory(session2, 'Message 2', mockCastSenseResult);

      clearMemory(session1);

      expect(await hasHistory(session1)).toBe(false);
      expect(await hasHistory(session2)).toBe(true);
    });

    test('should handle clearing non-existent session gracefully', () => {
      expect(() => clearMemory('non-existent')).not.toThrow();
    });
  });

  describe('clearAllMemory', () => {
    test('should remove all session memories', async () => {
      const session1 = 'session-x';
      const session2 = 'session-y';
      const session3 = 'session-z';

      await addToMemory(session1, 'Test 1', mockCastSenseResult);
      await addToMemory(session2, 'Test 2', mockCastSenseResult);
      await addToMemory(session3, 'Test 3', mockCastSenseResult);

      clearAllMemory();

      expect(await hasHistory(session1)).toBe(false);
      expect(await hasHistory(session2)).toBe(false);
      expect(await hasHistory(session3)).toBe(false);
    });

    test('should reset memory stats to zero', async () => {
      await addToMemory('session-a', 'Test', mockCastSenseResult);
      await addToMemory('session-b', 'Test', mockCastSenseResult);

      clearAllMemory();

      const stats = await getMemoryStats();
      expect(stats.sessionCount).toBe(0);
      expect(stats.sessionIds).toEqual([]);
    });

    test('should handle clearing empty memory store gracefully', () => {
      clearAllMemory();
      expect(() => clearAllMemory()).not.toThrow();
    });
  });

  // ==========================================================================
  // Memory Statistics
  // ==========================================================================

  describe('getMemoryStats', () => {
    test('should return zero stats for empty memory', async () => {
      const stats = await getMemoryStats();

      expect(stats.sessionCount).toBe(0);
      expect(stats.sessionIds).toEqual([]);
      expect(stats.messageCounts).toEqual({});
    });

    test('should return accurate session count', async () => {
      await addToMemory('s1', 'Test', mockCastSenseResult);
      await addToMemory('s2', 'Test', mockCastSenseResult);
      await addToMemory('s3', 'Test', mockCastSenseResult);

      const stats = await getMemoryStats();

      expect(stats.sessionCount).toBe(3);
      expect(stats.sessionIds).toHaveLength(3);
    });

    test('should return correct message counts per session', async () => {
      await addToMemory('session-1', 'Test', mockCastSenseResult);
      await addToMemory('session-2', 'Test 1', mockCastSenseResult);
      await addToMemory('session-2', 'Test 2', mockCastSenseResult);

      const stats = await getMemoryStats();

      expect(stats.messageCounts['session-1']).toBe(2); // 1 turn = 2 messages
      expect(stats.messageCounts['session-2']).toBe(4); // 2 turns = 4 messages
    });

    test('should include all session IDs', async () => {
      await addToMemory('alpha', 'Test', mockCastSenseResult);
      await addToMemory('beta', 'Test', mockCastSenseResult);
      await addToMemory('gamma', 'Test', mockCastSenseResult);

      const stats = await getMemoryStats();

      expect(stats.sessionIds).toContain('alpha');
      expect(stats.sessionIds).toContain('beta');
      expect(stats.sessionIds).toContain('gamma');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    test('should handle empty user message', async () => {
      const sessionId = 'edge-001';

      await addToMemory(sessionId, '', mockCastSenseResult);

      const history = await getConversationHistory(sessionId);
      expect(history[0].content).toBe('');
    });

    test('should handle very long user message', async () => {
      const sessionId = 'edge-002';
      const longMessage = 'a'.repeat(10000);

      await addToMemory(sessionId, longMessage, mockCastSenseResult);

      const history = await getConversationHistory(sessionId);
      expect(history[0].content).toBe(longMessage);
    });

    test('should handle special characters in user message', async () => {
      const sessionId = 'edge-003';
      const specialMessage = 'Test with "quotes", \\backslashes\\ and emoji 🎣';

      await addToMemory(sessionId, specialMessage, mockCastSenseResult);

      const history = await getConversationHistory(sessionId);
      expect(history[0].content).toBe(specialMessage);
    });

    test('should handle minimal CastSense result', async () => {
      const sessionId = 'edge-004';
      const minimalResult: CastSenseResult = {
        mode: 'general',
        zones: [],
        tactics: []
      };

      await addToMemory(sessionId, 'Test', minimalResult);

      const history = await getConversationHistory(sessionId);
      expect(history).toHaveLength(2);
      
      const parsed = JSON.parse(history[1].content as string);
      expect(parsed.zones).toEqual([]);
      expect(parsed.tactics).toEqual([]);
    });
  });
});
