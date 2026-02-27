/**
 * Analysis Orchestrator Tests
 * 
 * Verifies the orchestrator correctly coordinates the full analysis pipeline:
 * 1. Image processing
 * 2. Enrichment
 * 3. AI analysis (via LangChain)
 * 4. Validation
 */

// Mock expo modules before importing
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' }
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' }
}));

import { runAnalysis } from '../services/analysis-orchestrator';
import * as imageProcessor from '../services/image-processor';
import * as enrichment from '../services/enrichment';
import * as langchainChain from '../services/langchain-chain';

// Mock all dependencies
jest.mock('../services/image-processor');
jest.mock('../services/enrichment');
jest.mock('../services/langchain-chain');

const mockProcessImage = imageProcessor.processImage as jest.MockedFunction<typeof imageProcessor.processImage>;
const mockEnrichMetadata = enrichment.enrichMetadata as jest.MockedFunction<typeof enrichment.enrichMetadata>;
const mockAnalyzeWithLangChain = langchainChain.analyzeWithLangChain as jest.MockedFunction<typeof langchainChain.analyzeWithLangChain>;

describe('Analysis Orchestrator', () => {
  const mockPhotoUri = 'file:///test/photo.jpg';
  const mockLocation = { lat: 37.7749, lon: -122.4194 };
  const mockApiKey = 'test-api-key';
  const mockModel = 'gpt-4o';

  const mockProcessedImage = {
    uri: 'file:///test/processed.jpg',
    base64: 'base64-image-data',
    width: 1024,
    height: 768,
    wasResized: false
  };

  const mockEnrichmentResults = {
    overallStatus: 'degraded' as const,
    status: {
      reverse_geocode: 'ok' as const,
      weather: 'ok' as const,
      solar: 'ok' as const
    },
    results: {
      reverseGeocode: {
        waterbody_name: 'Test Lake',
        water_type: 'lake' as const,
        admin_area: 'Test County',
        country: 'USA'
      },
      weather: {
        temperature_f: 72,
        wind_speed_mph: 5,
        wind_direction_deg: 180,
        cloud_cover_pct: 25,
        pressure_inhg: 30.1,
        pressure_trend: 'rising' as const,
        precip_24h_in: 0
      },
      solar: {
        sunrise_local: '07:15',
        sunset_local: '17:45',
        daylight_phase: 'day' as const,
        season: 'winter' as const
      }
    }
  };

  const mockCastSenseResult = {
    mode: 'general' as const,
    zones: [
      {
        zone_id: 'zone_1',
        label: 'Near Dock',
        confidence: 0.85,
        target_species: 'bass',
        polygon: [[0, 0], [100, 0], [100, 100], [0, 100]] as [number, number][],
        cast_arrow: {
          start: [50, 50] as [number, number],
          end: [75, 75] as [number, number]
        },
        retrieve_path: [[75, 75], [50, 50]] as [number, number][]
      }
    ],
    tactics: [
      {
        zone_id: 'zone_1',
        recommended_rig: 'Crankbait',
        target_depth: '5-10 feet',
        retrieve_style: 'Steady retrieve with pauses',
        why_this_zone_works: ['Good structure near dock', 'Fish are likely near cover']
      }
    ],
    analysis_frame: {
      type: 'photo' as const,
      width_px: 1024,
      height_px: 768
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockProcessImage.mockResolvedValue(mockProcessedImage);
    mockEnrichMetadata.mockResolvedValue(mockEnrichmentResults);
    // Note: LangChain handles validation internally, no separate validation step needed
  });

  describe('Successful Analysis (LangChain)', () => {
    it('should complete full analysis pipeline with LangChain', async () => {
      // Mock LangChain success
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: true,
        data: mockCastSenseResult,
        model: mockModel,
        rawResponse: JSON.stringify(mockCastSenseResult),
        validation: {
          valid: true,
          errors: [],
          
          parsed: mockCastSenseResult
        }
      });

      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: {
          mode: 'general',
          platform: 'shore'
        },
        apiKey: mockApiKey,
        model: mockModel
      });

      // Verify success
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.model).toBe(mockModel);
      expect(result.data?.result).toEqual(mockCastSenseResult);

      // Verify all stages were called
      expect(mockProcessImage).toHaveBeenCalledWith(mockPhotoUri);
      expect(mockEnrichMetadata).toHaveBeenCalledWith(mockLocation);
      expect(mockAnalyzeWithLangChain).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: mockModel,
          imageBase64: mockProcessedImage.base64,
          imageWidth: mockProcessedImage.width,
          imageHeight: mockProcessedImage.height,
          location: mockLocation,
          apiKey: mockApiKey
        })
      );

      // Verify timings
      expect(result.data?.timings).toBeDefined();
      expect(result.data?.timings.total_ms).toBeGreaterThan(0);
    });

    it('should call progress callbacks at each stage', async () => {
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: true,
        data: mockCastSenseResult,
        model: mockModel,
        rawResponse: JSON.stringify(mockCastSenseResult),
        validation: {
          valid: true,
          errors: [],
          
          parsed: mockCastSenseResult
        }
      });

      const onProgress = jest.fn();

      await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: { mode: 'general' },
        apiKey: mockApiKey,
        model: mockModel,
        onProgress
      });

      // Verify progress callbacks
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'processing',
          message: 'Processing image...',
          progress: 0.1
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'enriching',
          message: 'Gathering environmental data...',
          progress: 0.3
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'analyzing',
          message: 'Analyzing fishing opportunities...',
          progress: 0.5
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'validating',
          message: 'Validating results...',
          progress: 0.9
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'complete',
          message: 'Analysis complete!',
          progress: 1.0
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle LangChain AI_TIMEOUT error', async () => {
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: false,
        error: {
          code: 'AI_TIMEOUT',
          message: 'AI analysis timed out after 30 seconds',
          retryable: true,
          details: {}
        }
      });

      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: { mode: 'general' },
        apiKey: mockApiKey,
        model: mockModel
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AI_TIMEOUT');
      expect(result.error?.retryable).toBe(true);
    });

    it('should handle LangChain AI_RATE_LIMITED error', async () => {
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: false,
        error: {
          code: 'AI_RATE_LIMITED',
          message: 'OpenAI rate limit reached',
          retryable: true,
          details: {}
        }
      });

      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: { mode: 'general' },
        apiKey: mockApiKey,
        model: mockModel
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AI_RATE_LIMITED');
      expect(result.error?.retryable).toBe(true);
    });

    it('should handle LangChain AI_INVALID_KEY error', async () => {
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: false,
        error: {
          code: 'AI_INVALID_KEY',
          message: 'Invalid API key',
          retryable: false,
          details: {}
        }
      });

      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: { mode: 'general' },
        apiKey: mockApiKey,
        model: mockModel
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AI_INVALID_KEY');
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle LangChain AI_NETWORK_ERROR error', async () => {
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: false,
        error: {
          code: 'AI_NETWORK_ERROR',
          message: 'Network error occurred',
          retryable: true,
          details: {}
        }
      });

      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: { mode: 'general' },
        apiKey: mockApiKey,
        model: mockModel
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.retryable).toBe(true);
    });

    it('should handle LangChain AI_PARSE_ERROR error', async () => {
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: false,
        error: {
          code: 'AI_PARSE_ERROR',
          message: 'Failed to parse AI response',
          retryable: true,
          details: { validationErrors: ['Invalid JSON'] }
        }
      });

      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: { mode: 'general' },
        apiKey: mockApiKey,
        model: mockModel
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.retryable).toBe(true);
    });

    it('should handle missing API key', async () => {
      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: { mode: 'general' },
        apiKey: '',
        model: mockModel
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_API_KEY');
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle invalid GPS location', async () => {
      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: { lat: 999, lon: 999 },
        options: { mode: 'general' },
        apiKey: mockApiKey,
        model: mockModel
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_GPS');
      expect(result.error?.retryable).toBe(false);
    });
  });

  describe('Integration with Enrichment', () => {
    it('should pass enrichment data to LangChain', async () => {
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: true,
        data: mockCastSenseResult,
        model: mockModel,
        rawResponse: JSON.stringify(mockCastSenseResult),
        validation: {
          valid: true,
          errors: [],
          
          parsed: mockCastSenseResult
        }
      });

      await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: {
          mode: 'specific',
          targetSpecies: 'bass'
        },
        apiKey: mockApiKey,
        model: mockModel
      });

      // Verify enrichment data was passed to LangChain
      expect(mockAnalyzeWithLangChain).toHaveBeenCalledWith(
        expect.objectContaining({
          enrichment: mockEnrichmentResults.results,
          options: expect.objectContaining({
            mode: 'specific',
            targetSpecies: 'bass'
          })
        })
      );
    });

    it('should include enrichment results in success response', async () => {
      mockAnalyzeWithLangChain.mockResolvedValue({
        success: true,
        data: mockCastSenseResult,
        model: mockModel,
        rawResponse: JSON.stringify(mockCastSenseResult),
        validation: {
          valid: true,
          errors: [],
          
          parsed: mockCastSenseResult
        }
      });

      const result = await runAnalysis({
        photoUri: mockPhotoUri,
        location: mockLocation,
        options: { mode: 'general' },
        apiKey: mockApiKey,
        model: mockModel
      });

      expect(result.success).toBe(true);
      expect(result.data?.enrichment).toEqual(mockEnrichmentResults.results);
    });
  });
});
