/**
 * LangChain Analysis Chain Tests
 * 
 * Tests the main analysis orchestration flow using LangChain components.
 */

import { analyzeWithLangChain, LangChainError } from '../services/langchain-chain';
import { createChatModel } from '../config/langchain';
import { formatAnalysisPrompt, buildContextPack } from '../services/langchain-prompts';
import { parseAIResult } from '../services/langchain-parsers';
import type { EnrichmentResults } from '../services/enrichment';

// Mock dependencies
jest.mock('../config/langchain');
jest.mock('../services/langchain-prompts');
jest.mock('../services/langchain-parsers');

const mockCreateChatModel = createChatModel as jest.MockedFunction<typeof createChatModel>;
const mockFormatAnalysisPrompt = formatAnalysisPrompt as jest.MockedFunction<typeof formatAnalysisPrompt>;
const mockBuildContextPack = buildContextPack as jest.MockedFunction<typeof buildContextPack>;
const mockParseAIResult = parseAIResult as jest.MockedFunction<typeof parseAIResult>;

// ============================================================================
// Test Fixtures
// ============================================================================

const MOCK_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUg'; // Truncated for brevity
const MOCK_API_KEY = 'sk-test-key-12345';

const MOCK_ENRICHMENT: EnrichmentResults = {
  reverseGeocode: {
    waterbody_name: 'Lake Test',
    water_type: 'lake',
    admin_area: 'Test County',
    country: 'USA'
  },
  weather: {
    temperature_f: 72,
    wind_speed_mph: 5,
    wind_direction_deg: 180,
    cloud_cover_pct: 25,
    pressure_inhg: 29.9,
    pressure_trend: 'steady',
    precip_24h_in: 0
  },
  solar: {
    sunrise_local: '06:30',
    sunset_local: '20:00',
    season: 'summer',
    daylight_phase: 'day'
  }
};

const MOCK_VALID_AI_RESPONSE = JSON.stringify({
  mode: 'general',
  likely_species: [
    { species: 'Largemouth Bass', confidence: 0.85 }
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
      polygon: [[0.2, 0.3], [0.4, 0.3], [0.4, 0.6], [0.2, 0.6]],
      cast_arrow: {
        start: [0.5, 0.9],
        end: [0.3, 0.45]
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
      recommended_rig: 'Texas-rigged worm',
      target_depth: '3-5 feet',
      retrieve_style: 'Slow drag with pauses',
      why_this_zone_works: ['Visible cover structure', 'Shaded area']
    }
  ],
  conditions_summary: ['Water temperature favorable for bass'],
  plan_summary: ['Start with primary zone near visible cover']
});

const MOCK_PARSED_RESULT = JSON.parse(MOCK_VALID_AI_RESPONSE);

// ============================================================================
// Setup/Teardown
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  
  // Default successful mocks
  mockBuildContextPack.mockReturnValue({
    mode: 'general',
    location: {
      lat: 37.7749,
      lon: -122.4194,
      waterbody_name: 'Lake Test',
      water_type: 'lake',
      admin_area: 'Test County',
      country: 'USA'
    },
    weather: {
      air_temp_f: 72,
      wind_speed_mph: 5,
      wind_direction_deg: 180,
      cloud_cover_pct: 25,
      pressure_inhg: 29.9,
      pressure_trend: 'steady',
      precip_last_24h_in: 0
    },
    time: {
      local_time: '10:30',
      season: 'summer',
      sunrise_local: '06:30',
      sunset_local: '20:00',
      daylight_phase: 'day'
    }
  });
  mockFormatAnalysisPrompt.mockResolvedValue('Analyze this fishing spot...');
  mockParseAIResult.mockResolvedValue({
    valid: true,
    errors: [],
    parsed: MOCK_PARSED_RESULT
  });
});

// ============================================================================
// Test Suites
// ============================================================================

describe('analyzeWithLangChain', () => {
  describe('successful analysis', () => {
    it('should complete full analysis flow for photo', async () => {
      // Setup mock model
      const mockInvoke = jest.fn().mockResolvedValue({
        content: MOCK_VALID_AI_RESPONSE
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      // Execute
      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      // Assertions
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.zones).toHaveLength(1);
        expect(result.data.tactics).toHaveLength(1);
        expect(result.data.analysis_frame).toEqual({
          type: 'photo',
          width_px: 1024,
          height_px: 768
        });
        expect(result.model).toBe('gpt-4o');
        expect(result.rawResponse).toBe(MOCK_VALID_AI_RESPONSE);
      }

      // Verify chain calls
      expect(mockCreateChatModel).toHaveBeenCalledWith(MOCK_API_KEY, 'gpt-4o');
      expect(mockFormatAnalysisPrompt).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith([
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({ type: 'text' }),
            expect.objectContaining({ 
              type: 'image_url',
              image_url: expect.objectContaining({
                url: `data:image/jpeg;base64,${MOCK_IMAGE_BASE64}`,
                detail: 'high'
              })
            })
          ])
        })
      ]);
      expect(mockParseAIResult).toHaveBeenCalledWith(MOCK_VALID_AI_RESPONSE);
    });

    it('should handle specific mode with target species', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        content: MOCK_VALID_AI_RESPONSE
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      // Mock buildContextPack to return specific mode context
      mockBuildContextPack.mockReturnValue({
        mode: 'specific',
        target_species: 'Rainbow Trout',
        user_context: {
          platform: 'shore',
          gear_type: 'spinning'
        }
      });

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { 
          mode: 'specific', 
          targetSpecies: 'Rainbow Trout',
          platform: 'shore',
          gearType: 'spinning'
        },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(true);
      
      // Verify buildContextPack was called with correct arguments
      expect(mockBuildContextPack).toHaveBeenCalledWith(
        MOCK_ENRICHMENT,
        { lat: 37.7749, lon: -122.4194 },
        expect.objectContaining({
          mode: 'specific',
          targetSpecies: 'Rainbow Trout',
          platform: 'shore',
          gearType: 'spinning'
        })
      );
    });

    it('should pass enrichment data to prompt builder', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        content: MOCK_VALID_AI_RESPONSE
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      // Verify buildContextPack was called with enrichment data
      expect(mockBuildContextPack).toHaveBeenCalledWith(
        MOCK_ENRICHMENT,
        { lat: 37.7749, lon: -122.4194 },
        { mode: 'general' }
      );
    });

    it('should support different vision models', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        content: MOCK_VALID_AI_RESPONSE
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const models = ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision-preview'];

      for (const modelName of models) {
        jest.clearAllMocks();
        mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);
        mockParseAIResult.mockResolvedValue({
          valid: true,
          errors: [],
          parsed: MOCK_PARSED_RESULT
        });

        const result = await analyzeWithLangChain({
          modelName,
          imageBase64: MOCK_IMAGE_BASE64,
          imageWidth: 1024,
          imageHeight: 768,
          enrichment: MOCK_ENRICHMENT,
          location: { lat: 37.7749, lon: -122.4194 },
          options: { mode: 'general' },
          apiKey: MOCK_API_KEY
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.model).toBe(modelName);
        }
        expect(mockCreateChatModel).toHaveBeenCalledWith(MOCK_API_KEY, modelName);
      }
    });

    it('should inject analysis_frame dimensions from request', async () => {
      // Mock response without analysis_frame
      const responseWithoutFrame = JSON.stringify({
        ...JSON.parse(MOCK_VALID_AI_RESPONSE),
        analysis_frame: undefined
      });

      const mockInvoke = jest.fn().mockResolvedValue({
        content: responseWithoutFrame
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const parsedWithoutFrame = JSON.parse(responseWithoutFrame);
      mockParseAIResult.mockResolvedValue({
        valid: true,
        errors: [],
        parsed: parsedWithoutFrame
      });

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 2048,
        imageHeight: 1536,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analysis_frame).toEqual({
          type: 'photo',
          width_px: 2048,
          height_px: 1536
        });
      }
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const mockInvoke = jest.fn().mockRejectedValue(
        new Error('Network request failed')
      );
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_NETWORK_ERROR');
        expect(result.error.retryable).toBe(true);
        expect(result.error.message).toContain('Network error');
      }
    });

    it('should handle timeout errors', async () => {
      const mockInvoke = jest.fn().mockRejectedValue(
        new Error('Request timeout after 30000ms')
      );
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_TIMEOUT');
        expect(result.error.retryable).toBe(true);
        expect(result.error.message).toContain('timed out');
      }
    });

    it('should handle invalid API key errors', async () => {
      const mockInvoke = jest.fn().mockRejectedValue(
        new Error('401 Unauthorized: Invalid API key')
      );
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: 'invalid-key'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_INVALID_KEY');
        expect(result.error.retryable).toBe(false);
        expect(result.error.message).toContain('Invalid API key');
      }
    });

    it('should handle rate limit errors', async () => {
      const mockInvoke = jest.fn().mockRejectedValue(
        new Error('429 Rate limit exceeded')
      );
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_RATE_LIMITED');
        expect(result.error.retryable).toBe(true);
        expect(result.error.message).toContain('rate limit');
      }
    });

    it('should handle OpenAI service errors (5xx)', async () => {
      const mockInvoke = jest.fn().mockRejectedValue(
        new Error('503 Service Unavailable')
      );
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_PROVIDER_ERROR');
        expect(result.error.retryable).toBe(true);
        expect(result.error.message).toContain('service error');
      }
    });

    it('should handle validation errors', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        content: '{"invalid": "data"}'
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      mockParseAIResult.mockResolvedValue({
        valid: false,
        errors: [
          { type: 'schema', message: 'Missing required field: zones' }
        ]
      });

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_PARSE_ERROR');
        expect(result.error.retryable).toBe(true);
        expect(result.error.message).toContain('validation failed');
      }
    });

    it('should handle empty AI response', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        content: ''
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_PROVIDER_ERROR');
        expect(result.error.message).toContain('Empty response');
      }
    });

    it('should handle non-string AI response content', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        content: { nested: 'object' }
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      // Should stringify object content
      mockParseAIResult.mockResolvedValue({
        valid: true,
        errors: [],
        parsed: MOCK_PARSED_RESULT
      });

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(true);
      expect(mockParseAIResult).toHaveBeenCalledWith('{"nested":"object"}');
    });

    it('should preserve LangChainError instances', async () => {
      const customError = new LangChainError(
        'Custom error message',
        'AI_PROVIDER_ERROR',
        false,
        { custom: 'details' }
      );

      const mockInvoke = jest.fn().mockRejectedValue(customError);
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AI_PROVIDER_ERROR');
        expect(result.error.message).toBe('Custom error message');
        expect(result.error.retryable).toBe(false);
        expect(result.error.details).toEqual({ custom: 'details' });
      }
    });
  });

  describe('edge cases', () => {
    it('should handle minimal enrichment data', async () => {
      const minimalEnrichment: EnrichmentResults = {
        reverseGeocode: null,
        weather: null,
        solar: null
      };

      // Mock buildContextPack to return minimal context
      mockBuildContextPack.mockReturnValue({
        mode: 'general'
      });

      const mockInvoke = jest.fn().mockResolvedValue({
        content: MOCK_VALID_AI_RESPONSE
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: minimalEnrichment,
        location: { lat: 0, lon: 0 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(true);
      
      // Verify buildContextPack was called with minimal enrichment
      expect(mockBuildContextPack).toHaveBeenCalledWith(
        minimalEnrichment,
        { lat: 0, lon: 0 },
        { mode: 'general' }
      );
    });

    it('should handle large image dimensions', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        content: MOCK_VALID_AI_RESPONSE
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 4096,
        imageHeight: 3072,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analysis_frame?.width_px).toBe(4096);
        expect(result.data.analysis_frame?.height_px).toBe(3072);
      }
    });

    it('should handle validation warnings (valid but with errors)', async () => {
      const mockInvoke = jest.fn().mockResolvedValue({
        content: MOCK_VALID_AI_RESPONSE
      });
      mockCreateChatModel.mockReturnValue({ invoke: mockInvoke } as any);

      mockParseAIResult.mockResolvedValue({
        valid: true,
        errors: [
          { type: 'geometry', message: 'Zone A has no tactics (warning)' }
        ],
        parsed: MOCK_PARSED_RESULT
      });

      const result = await analyzeWithLangChain({
        modelName: 'gpt-4o',
        imageBase64: MOCK_IMAGE_BASE64,
        imageWidth: 1024,
        imageHeight: 768,
        enrichment: MOCK_ENRICHMENT,
        location: { lat: 37.7749, lon: -122.4194 },
        options: { mode: 'general' },
        apiKey: MOCK_API_KEY
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validation.valid).toBe(true);
        expect(result.validation.errors).toHaveLength(1);
      }
    });
  });
});
