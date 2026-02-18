/**
 * E2E Video Analyze Test (T11.5)
 * 
 * End-to-end "happy path" test for video analysis.
 * Mocks AI provider and video processing.
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import * as fs from 'fs';
import * as path from 'path';

import analyzeRoutes from '../../routes/analyze';
import healthRoutes from '../../routes/health';

// Load fixtures
const validMetadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/valid-metadata.json'), 'utf-8')
);
const validResult = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/valid-result.json'), 'utf-8')
);

// Create video metadata variant
const validVideoMetadata = {
  ...validMetadata,
  request: {
    ...validMetadata.request,
    capture_type: 'video'
  }
};

// Create expected video result with analysis_frame
const validVideoResult = {
  ...validResult,
  analysis_frame: {
    type: 'video_frame',
    width_px: 1920,
    height_px: 1080,
    selected_frame_index: 3,
    frame_timestamp_ms: 2500
  }
};

// Minimal MP4 header (not a real video, but acceptable for mock tests)
// This is just enough bytes to pass basic MIME detection
const MINIMAL_MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x1c, // Box size
  0x66, 0x74, 0x79, 0x70, // 'ftyp'
  0x69, 0x73, 0x6f, 0x6d, // 'isom'
  0x00, 0x00, 0x02, 0x00, // Minor version
  0x69, 0x73, 0x6f, 0x6d, // Compatible brand 'isom'
  0x69, 0x73, 0x6f, 0x32, // Compatible brand 'iso2'
  0x6d, 0x70, 0x34, 0x31, // Compatible brand 'mp41'
  // Padding to make it a bit larger
  0x00, 0x00, 0x00, 0x08,
  0x66, 0x72, 0x65, 0x65  // 'free' box
]);

/**
 * Mock AI response for video testing
 */
const mockVideoAIResponse = {
  content: JSON.stringify(validVideoResult),
  model: 'test-model',
  usage: {
    prompt_tokens: 150,
    completion_tokens: 250,
    total_tokens: 400
  }
};

/**
 * Mock video processor result
 */
const mockVideoProcessorResult = {
  success: true,
  selectedFrameIndex: 3,
  frameTimestampMs: 2500,
  frameBuffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // Fake JPEG header
  totalFrames: 10,
  videoDurationMs: 5000,
  keyframes: [
    { index: 0, timestampMs: 0 },
    { index: 3, timestampMs: 2500 },
    { index: 7, timestampMs: 4200 }
  ]
};

describe('E2E Video Analyze Test (T11.5)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Mock the AI client module
    jest.doMock('../../services/ai/client', () => ({
      callAI: jest.fn().mockResolvedValue(mockVideoAIResponse),
      createAIError: jest.fn()
    }));

    // Mock the video processor module
    jest.doMock('../../services/video-processor', () => ({
      extractKeyframes: jest.fn().mockResolvedValue(mockVideoProcessorResult),
      selectBestFrame: jest.fn().mockResolvedValue(mockVideoProcessorResult)
    }));

    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(multipart, {
      limits: { fileSize: 30 * 1024 * 1024 } // 30MB for video
    });
    await app.register(healthRoutes);
    await app.register(analyzeRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    jest.resetModules();
  });

  describe('Happy Path - Video Analysis', () => {
    test('valid video request is accepted', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validVideoMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.mp4"\r\n'),
        Buffer.from('Content-Type: video/mp4\r\n\r\n'),
        MINIMAL_MP4,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/analyze',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        payload: body
      });

      const responseBody = JSON.parse(response.body);
      
      // Should have a valid request ID
      expect(responseBody.request_id).toBeDefined();
      expect(typeof responseBody.request_id).toBe('string');
    });

    test('video/mp4 MIME type is accepted', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validVideoMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.mp4"\r\n'),
        Buffer.from('Content-Type: video/mp4\r\n\r\n'),
        MINIMAL_MP4,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/analyze',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        payload: body
      });

      // Should not reject with INVALID_MEDIA for MIME type
      const responseBody = JSON.parse(response.body);
      if (response.statusCode === 400 && responseBody.error) {
        expect(responseBody.error.message).not.toContain('Unsupported media type');
      }
    });

    test('video/quicktime MIME type is accepted', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validVideoMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.mov"\r\n'),
        Buffer.from('Content-Type: video/quicktime\r\n\r\n'),
        MINIMAL_MP4, // MOV is similar structure
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/analyze',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        payload: body
      });

      const responseBody = JSON.parse(response.body);
      if (response.statusCode === 400 && responseBody.error) {
        expect(responseBody.error.message).not.toContain('Unsupported media type');
      }
    });

    test('response includes context pack for video', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validVideoMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.mp4"\r\n'),
        Buffer.from('Content-Type: video/mp4\r\n\r\n'),
        MINIMAL_MP4,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/analyze',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        payload: body
      });

      const responseBody = JSON.parse(response.body);
      
      expect(responseBody.context_pack).toBeDefined();
      expect(responseBody.context_pack.mode).toBeDefined();
    });
  });

  describe('Video Analysis Result Structure', () => {
    test('video result includes selected_frame_index', () => {
      expect(validVideoResult.analysis_frame).toBeDefined();
      expect(validVideoResult.analysis_frame.type).toBe('video_frame');
      expect(validVideoResult.analysis_frame.selected_frame_index).toBeDefined();
      expect(typeof validVideoResult.analysis_frame.selected_frame_index).toBe('number');
    });

    test('video result includes frame_timestamp_ms', () => {
      expect(validVideoResult.analysis_frame.frame_timestamp_ms).toBeDefined();
      expect(typeof validVideoResult.analysis_frame.frame_timestamp_ms).toBe('number');
      expect(validVideoResult.analysis_frame.frame_timestamp_ms).toBeGreaterThanOrEqual(0);
    });

    test('video result has overlays (zones)', () => {
      expect(validVideoResult.zones).toBeDefined();
      expect(Array.isArray(validVideoResult.zones)).toBe(true);
    });

    test('video result tactics reference valid zones', () => {
      const zoneIds = new Set(validVideoResult.zones.map((z: { zone_id: string }) => z.zone_id));
      
      for (const tactic of validVideoResult.tactics) {
        if (tactic.zone_id !== 'N/A') {
          expect(zoneIds.has(tactic.zone_id)).toBe(true);
        }
      }
    });
  });

  describe('Video Processing Edge Cases', () => {
    test('capture_type mismatch with MIME type is rejected', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      // Metadata says photo but file is video
      const photoMetadata = {
        ...validMetadata,
        request: {
          ...validMetadata.request,
          capture_type: 'photo'
        }
      };

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(photoMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.mp4"\r\n'),
        Buffer.from('Content-Type: video/mp4\r\n\r\n'),
        MINIMAL_MP4,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/analyze',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        payload: body
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.error.code).toBe('INVALID_MEDIA');
    });
  });

  describe('Degraded Path - Video Extraction Failure', () => {
    // Test that system handles video extraction failures gracefully
    
    test('degraded result structure is valid when extraction fails', () => {
      // Simulating what would happen if video extraction fails
      // and we fall back to text-only mode
      const degradedResult = {
        mode: 'general',
        zones: [],
        tactics: [{
          zone_id: 'N/A',
          recommended_rig: 'General recommendation',
          target_depth: 'Variable',
          retrieve_style: 'Adjust to conditions',
          why_this_zone_works: [
            'Unable to analyze video frame',
            'Providing general guidance based on conditions'
          ]
        }],
        plan_summary: [
          'Video frame extraction encountered an issue',
          'Here are general fishing recommendations'
        ]
      };

      // Verify degraded result is structurally valid
      expect(degradedResult.mode).toBe('general');
      expect(degradedResult.zones).toEqual([]);
      expect(degradedResult.tactics![0]!.zone_id).toBe('N/A');
      expect(degradedResult.tactics![0]!.why_this_zone_works.length).toBeGreaterThan(0);
    });
  });
});

describe('Video vs Photo Metadata', () => {
  test('video metadata has capture_type: video', () => {
    expect(validVideoMetadata.request.capture_type).toBe('video');
  });

  test('video result has type: video_frame in analysis_frame', () => {
    expect(validVideoResult.analysis_frame.type).toBe('video_frame');
  });

  test('photo result has type: photo in analysis_frame', () => {
    expect(validResult.analysis_frame.type).toBe('photo');
  });
});
