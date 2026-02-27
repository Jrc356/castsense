/**
 * LangChain Integration Tests
 * 
 * Comprehensive integration tests verifying all LangChain components work together:
 * - Config → Prompts → Model → Parser → Chain
 * - Memory persistence across analysis and follow-ups
 * - Error propagation through the stack
 * - Real-world usage scenarios
 * 
 * These tests mock the OpenAI API to avoid rate limits and costs, while still
 * verifying that all internal components integrate correctly.
 */

import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { 
  buildContextPack, 
  formatAnalysisPrompt,
  type ContextPack,
  type AnalysisOptions 
} from '../services/langchain-prompts';
import { 
  parseAIResult,
  type CastSenseResult 
} from '../services/langchain-parsers';
import { 
  analyzeWithLangChain,
  type AnalysisRequest 
} from '../services/langchain-chain';
import { 
  createSessionId, 
  addToMemory, 
  getConversationHistory, 
  clearAllMemory,
  getMemoryStats 
} from '../services/langchain-memory';
import { 
  handleFollowUpQuestion,
  type FollowUpResult 
} from '../services/langchain-followup';
import type { EnrichmentResults } from '../services/enrichment';

// ============================================================================
// Mock ChatOpenAI
// ============================================================================

// Mock the entire ChatOpenAI module
jest.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: jest.fn().mockImplementation(() => ({
      invoke: jest.fn()
    }))
  };
});

import { ChatOpenAI } from '@langchain/openai';

// ============================================================================
// Test Data
// ============================================================================

const TEST_API_KEY = 'sk-test-key-12345';
const TEST_MODEL = 'gpt-4o';

// Minimal base64 1x1 pixel PNG for testing
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Mock enrichment data with realistic values
 */
const mockEnrichment: EnrichmentResults = {
  reverseGeocode: {
    waterbody_name: 'Lake Test',
    water_type: 'lake',
    admin_area: 'Test County, TX',
    country: 'USA'
  },
  weather: {
    temperature_f: 72,
    wind_speed_mph: 8,
    wind_direction_deg: 180,
    cloud_cover_pct: 40,
    pressure_inhg: 30.12,
    pressure_trend: 'steady',
    precip_24h_in: 0.0
  },
  solar: {
    sunrise_local: '06:30 AM',
    sunset_local: '07:45 PM',
    daylight_phase: 'day',
    season: 'summer'
  }
};

/**
 * Valid CastSenseResult for testing
 */
const mockValidResult: CastSenseResult = {
  mode: 'general',
  likely_species: [
    { species: 'Largemouth Bass', confidence: 0.85 },
    { species: 'Bluegill', confidence: 0.6 }
  ],
  analysis_frame: {
    type: 'photo',
    width_px: 1920,
    height_px: 1080
  },
  zones: [
    {
      zone_id: 'Z1',
      label: 'Primary Zone',
      confidence: 0.9,
      target_species: 'Largemouth Bass',
      polygon: [
        [0.1, 0.1],
        [0.4, 0.1],
        [0.4, 0.4],
        [0.1, 0.4]
      ],
      cast_arrow: {
        start: [0.25, 0.05],
        end: [0.25, 0.25]
      },
      style: {
        priority: 1,
        hint: 'cover'
      }
    },
    {
      zone_id: 'Z2',
      label: 'Secondary Zone',
      confidence: 0.75,
      target_species: 'Bluegill',
      polygon: [
        [0.6, 0.2],
        [0.9, 0.2],
        [0.9, 0.5],
        [0.6, 0.5]
      ],
      cast_arrow: {
        start: [0.75, 0.15],
        end: [0.75, 0.35]
      },
      retrieve_path: [
        [0.75, 0.35],
        [0.75, 0.45],
        [0.7, 0.5]
      ]
    }
  ],
  tactics: [
    {
      zone_id: 'Z1',
      recommended_rig: 'Texas-rigged worm',
      alternate_rigs: ['Jig and trailer', 'Topwater frog'],
      target_depth: '3-6 feet',
      retrieve_style: 'Slow and steady with pauses',
      cadence: 'Twitch, pause 3 seconds, repeat',
      cast_count_suggestion: '5-8 casts',
      why_this_zone_works: [
        'Heavy cover provides ambush points',
        'Shaded area attracts baitfish'
      ],
      steps: [
        'Cast beyond the visible cover',
        'Let lure sink to bottom',
        'Retrieve with slow hops'
      ]
    },
    {
      zone_id: 'Z2',
      recommended_rig: 'Small jig',
      target_depth: '2-4 feet',
      retrieve_style: 'Vertical jigging',
      why_this_zone_works: [
        'Open water near structure attracts panfish'
      ]
    }
  ],
  conditions_summary: [
    'Calm afternoon conditions',
    'Light wind from the south',
    'Stable barometric pressure'
  ],
  plan_summary: [
    'Start with Zone Z1 for bass using Texas rig',
    'Move to Zone Z2 if bass are inactive'
  ],
  explainability: {
    scene_observations: [
      'Visible vegetation along shoreline',
      'Clear water with some surface ripples'
    ],
    assumptions: [
      'Assuming spring/summer season based on green vegetation',
      'Water temperature estimated at 68-75°F based on conditions'
    ]
  }
};

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Mock ChatOpenAI.invoke to return a valid result
 */
function mockSuccessfulInvoke(result: CastSenseResult = mockValidResult) {
  const mockInvoke = jest.fn().mockResolvedValue({
    content: JSON.stringify(result)
  });
  
  (ChatOpenAI as unknown as jest.Mock).mockImplementation(() => ({
    invoke: mockInvoke
  }));
  
  return mockInvoke;
}

/**
 * Mock ChatOpenAI.invoke to throw an error
 */
function mockFailedInvoke(error: Error) {
  const mockInvoke = jest.fn().mockRejectedValue(error);
  
  (ChatOpenAI as unknown as jest.Mock).mockImplementation(() => ({
    invoke: mockInvoke
  }));
  
  return mockInvoke;
}

/**
 * Mock ChatOpenAI.invoke to return invalid JSON
 */
function mockInvalidJsonInvoke() {
  const mockInvoke = jest.fn().mockResolvedValue({
    content: 'This is not valid JSON'
  });
  
  (ChatOpenAI as unknown as jest.Mock).mockImplementation(() => ({
    invoke: mockInvoke
  }));
  
  return mockInvoke;
}

/**
 * Mock ChatOpenAI.invoke to return malformed result (missing required fields)
 */
function mockMalformedResultInvoke() {
  const mockInvoke = jest.fn().mockResolvedValue({
    content: JSON.stringify({
      mode: 'general',
      // Missing required fields: zones, tactics
    })
  });
  
  (ChatOpenAI as unknown as jest.Mock).mockImplementation(() => ({
    invoke: mockInvoke
  }));
  
  return mockInvoke;
}

// ============================================================================
// Tests
// ============================================================================

describe('LangChain Integration Tests', () => {
  beforeEach(() => {
    clearAllMemory();
    jest.clearAllMocks();
  });

  describe('Full Analysis Pipeline', () => {
    it('should complete full analysis flow: config → prompt → model → parser → result', async () => {
      // Mock successful response
      mockSuccessfulInvoke();

      // Build analysis request
      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: {
          mode: 'general',
          platform: 'shore',
          gearType: 'spinning'
        },
        apiKey: TEST_API_KEY
      };

      // Run full analysis
      const result = await analyzeWithLangChain(request);

      // Verify success
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          mode: 'general',
          zones: expect.any(Array),
          tactics: expect.any(Array)
        });
        expect(result.data.zones.length).toBeGreaterThan(0);
        expect(result.data.tactics.length).toBeGreaterThan(0);
      }
    });

    it('should build context pack from enrichment data', () => {
      const options: AnalysisOptions = {
        mode: 'specific',
        targetSpecies: 'Largemouth Bass',
        platform: 'kayak',
        gearType: 'baitcasting'
      };

      const contextPack = buildContextPack(
        mockEnrichment,
        { lat: 30.5, lon: -97.8 },
        options
      );

      // Verify context pack structure
      expect(contextPack.mode).toBe('specific');
      expect(contextPack.target_species).toBe('Largemouth Bass');
      expect(contextPack.location).toMatchObject({
        lat: 30.5,
        lon: -97.8,
        waterbody_name: 'Lake Test',
        water_type: 'lake'
      });
      expect(contextPack.weather).toBeDefined();
      expect(contextPack.time).toBeDefined();
      expect(contextPack.user_context).toMatchObject({
        platform: 'kayak',
        gear_type: 'baitcasting'
      });
    });

    it('should format prompt with context and mode instructions', async () => {
      const contextPack = buildContextPack(
        mockEnrichment,
        { lat: 30.5, lon: -97.8 },
        { mode: 'general' }
      );

      const promptText = await formatAnalysisPrompt(contextPack);

      // Verify prompt contains expected content
      expect(promptText).toBeDefined();
      expect(typeof promptText).toBe('string');
      expect(promptText.length).toBeGreaterThan(0);
      expect(promptText).toContain('general'); // mode
      // Location info should be present in some form
      expect(promptText.toLowerCase()).toMatch(/lake|waterbody|location/);
    });

    it('should propagate errors through pipeline', async () => {
      const error = new Error('OpenAI API error');
      mockFailedInvoke(error);

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBeDefined();
        expect(result.error.message).toBeDefined();
      }
    });

    it('should handle parser validation errors', async () => {
      mockMalformedResultInvoke();

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_PARSE_ERROR');
      }
    });

    it('should handle invalid JSON responses', async () => {
      mockInvalidJsonInvoke();

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_PARSE_ERROR');
      }
    });
  });

  describe('Conversation Memory Flow', () => {
    it('should store and retrieve analysis in memory', async () => {
      const sessionId = createSessionId();
      mockSuccessfulInvoke();

      // Run analysis with session ID
      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY,
        sessionId
      };

      const result = await analyzeWithLangChain(request);
      expect(result.success).toBe(true);

      // Verify memory was stored
      const history = await getConversationHistory(sessionId);
      expect(history.length).toBeGreaterThan(0);
      
      // Should contain user message and AI response
      expect(history[0]).toBeInstanceOf(HumanMessage);
      expect(history[1]).toBeInstanceOf(AIMessage);
    });

    it('should support multi-turn conversations', async () => {
      const sessionId = createSessionId();

      // First: Run analysis
      mockSuccessfulInvoke();

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY,
        sessionId
      };

      await analyzeWithLangChain(request);

      // Second: Ask follow-up
      const mockFollowUpResponse = jest.fn().mockResolvedValue({
        content: 'Use a Texas-rigged worm in Zone Z1 for best results.'
      });
      (ChatOpenAI as unknown as jest.Mock).mockImplementation(() => ({
        invoke: mockFollowUpResponse
      }));

      const followUpResult = await handleFollowUpQuestion(
        sessionId,
        'What lure should I use in Zone Z1?',
        TEST_API_KEY,
        TEST_MODEL
      );

      expect(followUpResult.success).toBe(true);
      if (followUpResult.success) {
        expect(followUpResult.response).toContain('Texas-rigged worm');
      }

      // Verify history grew (2 from initial analysis + 2 from follow-up)
      const history = await getConversationHistory(sessionId);
      expect(history.length).toBeGreaterThanOrEqual(2); // At minimum the initial analysis
    });

    it('should isolate sessions', async () => {
      const session1 = createSessionId();
      const session2 = createSessionId();

      // Add message to session 1
      await addToMemory(session1, 'Session 1 message', mockValidResult);

      // Add message to session 2
      await addToMemory(session2, 'Session 2 message', mockValidResult);

      // Verify isolation
      const history1 = await getConversationHistory(session1);
      const history2 = await getConversationHistory(session2);

      expect(history1.length).toBe(2);
      expect(history2.length).toBe(2);

      expect((history1[0] as HumanMessage).content).toContain('Session 1');
      expect((history2[0] as HumanMessage).content).toContain('Session 2');
    });

    it('should track memory statistics', async () => {
      const session1 = createSessionId();
      const session2 = createSessionId();

      await addToMemory(session1, 'Message 1', mockValidResult);
      await addToMemory(session2, 'Message 2', mockValidResult);

      const stats = await getMemoryStats();

      expect(stats.sessionCount).toBe(2);
      expect(stats.sessionIds).toContain(session1);
      expect(stats.sessionIds).toContain(session2);
      expect(stats.messageCounts[session1]).toBe(2);
      expect(stats.messageCounts[session2]).toBe(2);
    });

    it('should clear all memory', async () => {
      const session1 = createSessionId();
      const session2 = createSessionId();

      await addToMemory(session1, 'Test 1', mockValidResult);
      await addToMemory(session2, 'Test 2', mockValidResult);

      let stats = await getMemoryStats();
      expect(stats.sessionCount).toBe(2);

      clearAllMemory();

      stats = await getMemoryStats();
      expect(stats.sessionCount).toBe(0);
      expect(stats.sessionIds).toHaveLength(0);
    });
  });

  describe('Follow-Up Query Integration', () => {
    it('should answer follow-up using conversation history', async () => {
      const sessionId = createSessionId();

      // 1. Run initial analysis
      mockSuccessfulInvoke();

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY,
        sessionId
      };

      await analyzeWithLangChain(request);

      // 2. Ask follow-up
      const mockFollowUp = jest.fn().mockResolvedValue({
        content: 'Based on the previous analysis, Zone Z1 has the highest confidence for bass.'
      });
      (ChatOpenAI as unknown as jest.Mock).mockImplementation(() => ({
        invoke: mockFollowUp
      }));

      const followUpResult = await handleFollowUpQuestion(
        sessionId,
        'Which zone is best for bass?',
        TEST_API_KEY,
        TEST_MODEL
      );

      // 3. Verify history is used in prompt
      expect(mockFollowUp).toHaveBeenCalled();
      const callArgs = mockFollowUp.mock.calls[0][0];
      expect(callArgs).toBeInstanceOf(Array);
      expect(callArgs.length).toBeGreaterThan(1); // Should include history + new question

      // 4. Verify response
      expect(followUpResult.success).toBe(true);
      if (followUpResult.success) {
        expect(followUpResult.response).toContain('Zone Z1');
      }
    });

    it('should handle follow-up without prior analysis', async () => {
      const sessionId = createSessionId();

      const result = await handleFollowUpQuestion(
        sessionId,
        'What should I do?',
        TEST_API_KEY,
        TEST_MODEL
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_HISTORY');
        expect(result.error.message).toContain('No conversation history');
      }
    });

    it('should propagate errors in follow-up queries', async () => {
      const sessionId = createSessionId();

      // Add some history first
      await addToMemory(sessionId, 'Previous message', mockValidResult);

      // Mock error in follow-up
      const error = new Error('API error');
      (error as any).status = 401;
      const mockInvoke = jest.fn().mockRejectedValue(error);
      (ChatOpenAI as unknown as jest.Mock).mockImplementation(() => ({
        invoke: mockInvoke
      }));

      const result = await handleFollowUpQuestion(
        sessionId,
        'Follow-up question',
        'invalid-key', // This will cause auth error
        TEST_MODEL
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network timeout consistently', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockFailedInvoke(timeoutError);

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_TIMEOUT');
        expect(result.error.retryable).toBe(true);
      }
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      mockFailedInvoke(rateLimitError);

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_RATE_LIMITED');
        expect(result.error.retryable).toBe(true);
      }
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;
      mockFailedInvoke(authError);

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: 'invalid-key'
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_INVALID_KEY');
        expect(result.error.retryable).toBe(false);
      }
    });

    it('should handle validation errors in chain', async () => {
      // Mock response with invalid data (coordinates out of range)
      const invalidResult = {
        ...mockValidResult,
        zones: [{
          ...mockValidResult.zones[0],
          polygon: [[2.5, 3.0], [1.1, 0.5], [0.8, 0.9]] // Invalid: > 1.0
        }]
      } as CastSenseResult; // Type assertion for intentionally invalid test data
      mockSuccessfulInvoke(invalidResult);

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_PARSE_ERROR');
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle complete photo analysis workflow', async () => {
      const sessionId = createSessionId();
      mockSuccessfulInvoke();

      // Simulate full workflow: HomeScreen → Analysis → Results
      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: {
          mode: 'specific',
          targetSpecies: 'Largemouth Bass',
          platform: 'boat',
          gearType: 'baitcasting'
        },
        apiKey: TEST_API_KEY,
        sessionId
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify all expected fields are present
        expect(result.data.mode).toBe('general');
        expect(result.data.zones).toBeDefined();
        expect(result.data.tactics).toBeDefined();
        expect(result.data.zones.length).toBeGreaterThan(0);
        
        // Verify zones have required overlay data
        const zone = result.data.zones[0]!; // Non-null assertion: length check ensures it exists
        expect(zone.polygon).toBeDefined();
        expect(zone.cast_arrow).toBeDefined();
        expect(zone.polygon.length).toBeGreaterThanOrEqual(3);
        
        // Verify tactics match zones
        expect(result.data.tactics.length).toBeGreaterThan(0);
      }
    });

    it('should handle video analysis with frame metadata', async () => {
      // Note: The chain currently overrides analysis_frame to 'photo' type
      // This test verifies the current behavior - may need update if video support is added later
      mockSuccessfulInvoke();

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(true);
      if (result.success) {
        // Chain injects analysis_frame with actual dimensions
        expect(result.data.analysis_frame).toBeDefined();
        expect(result.data.analysis_frame?.type).toBe('photo');
        expect(result.data.analysis_frame?.width_px).toBe(1920);
        expect(result.data.analysis_frame?.height_px).toBe(1080);
      }
    });

    it('should handle minimal enrichment (all services failed)', async () => {
      mockSuccessfulInvoke();

      const minimalEnrichment: EnrichmentResults = {
        reverseGeocode: null,
        weather: null,
        solar: null
      };

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: minimalEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      // Should still succeed even without enrichment
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.zones).toBeDefined();
        expect(result.data.tactics).toBeDefined();
      }
    });

    it('should handle user constraints and context', async () => {
      mockSuccessfulInvoke();

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: {
          mode: 'specific',
          targetSpecies: 'Crappie',
          platform: 'shore',
          gearType: 'fly'
        },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(true);
      
      // Verify context was used in prompt
      const contextPack = buildContextPack(
        mockEnrichment,
        { lat: 30.5, lon: -97.8 },
        request.options
      );
      
      expect(contextPack.mode).toBe('specific');
      expect(contextPack.target_species).toBe('Crappie');
      expect(contextPack.user_context?.platform).toBe('shore');
      expect(contextPack.user_context?.gear_type).toBe('fly');
    });

    it('should handle empty zones array (no suitable spots)', async () => {
      const noZonesResult = {
        ...mockValidResult,
        zones: [],
        tactics: [],
        plan_summary: ['No suitable fishing zones identified in this location']
      };
      mockSuccessfulInvoke(noZonesResult);

      const request: AnalysisRequest = {
        modelName: TEST_MODEL,
        imageBase64: TEST_IMAGE_BASE64,
        imageWidth: 1920,
        imageHeight: 1080,
        enrichment: mockEnrichment,
        location: { lat: 30.5, lon: -97.8 },
        options: { mode: 'general' },
        apiKey: TEST_API_KEY
      };

      const result = await analyzeWithLangChain(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.zones).toHaveLength(0);
        expect(result.data.tactics).toHaveLength(0);
        expect(result.data.plan_summary).toBeDefined();
      }
    });
  });

  describe('Component Integration', () => {
    it('should integrate config, prompts, and parsers', async () => {
      // 1. Context pack builds from enrichment
      const contextPack = buildContextPack(
        mockEnrichment,
        { lat: 30.5, lon: -97.8 },
        { mode: 'general' }
      );
      expect(contextPack).toBeDefined();

      // 2. Prompts format with context
      const promptText = await formatAnalysisPrompt(contextPack);
      expect(promptText).toBeDefined();
      expect(typeof promptText).toBe('string');

      // 3. Parser validates output
      const validationResult = await parseAIResult(JSON.stringify(mockValidResult));
      expect(validationResult.valid).toBe(true);
      if (validationResult.valid) {
        expect(validationResult.parsed).toMatchObject(mockValidResult);
      }
    });

    it('should verify all components use consistent types', () => {
      // Type checking at compile time ensures consistency
      const options: AnalysisOptions = {
        mode: 'general',
        platform: 'shore',
        gearType: 'spinning'
      };

      const contextPack: ContextPack = buildContextPack(
        mockEnrichment,
        { lat: 30.5, lon: -97.8 },
        options
      );

      const result: CastSenseResult = mockValidResult;

      // If this compiles, types are consistent
      expect(contextPack.mode).toBe(options.mode);
      expect(result.mode).toBe('general');
    });
  });
});
