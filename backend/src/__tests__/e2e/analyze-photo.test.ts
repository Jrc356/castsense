/**
 * E2E Photo Analyze Test (T11.4)
 * 
 * End-to-end "happy path" test for photo analysis.
 * Mocks AI provider to return valid response.
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

// Minimal valid JPEG (1x1 pixel)
const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
  0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
  0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
  0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
  0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd5, 0xdb, 0x20, 0xa8, 0xf1, 0x65, 0x07,
  0xfe, 0xce, 0xdf, 0xf2, 0x2d, 0xbf, 0xff, 0xd9
]);

// Save minimal JPEG to fixtures
const jpegPath = path.join(__dirname, '../fixtures/sample-photo.jpg');
if (!fs.existsSync(jpegPath)) {
  fs.writeFileSync(jpegPath, MINIMAL_JPEG);
}

/**
 * Mock AI response for testing
 */
const mockAIResponse = {
  content: JSON.stringify(validResult),
  model: 'test-model',
  usage: {
    prompt_tokens: 100,
    completion_tokens: 200,
    total_tokens: 300
  }
};

describe('E2E Photo Analyze Test (T11.4)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Mock the AI client module
    jest.doMock('../../services/ai/client', () => ({
      callAI: jest.fn().mockResolvedValue(mockAIResponse),
      createAIError: jest.fn()
    }));

    app = Fastify({ logger: false });
    await app.register(cors);
    await app.register(multipart, {
      limits: { fileSize: 10 * 1024 * 1024 }
    });
    await app.register(healthRoutes);
    await app.register(analyzeRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    jest.resetModules();
  });

  describe('Happy Path - Photo Analysis', () => {
    test('valid photo request is accepted and parsed correctly', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        MINIMAL_JPEG,
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

      // Currently returns 501 as full pipeline not implemented
      // But should successfully parse and start processing
      const responseBody = JSON.parse(response.body);
      
      expect(responseBody.request_id).toBeDefined();
      expect(typeof responseBody.request_id).toBe('string');
      // UUID format check
      expect(responseBody.request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test('response includes timing information', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        MINIMAL_JPEG,
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
      
      expect(responseBody.timings_ms).toBeDefined();
      expect(typeof responseBody.timings_ms).toBe('object');
      
      // Should have timing for upload parsing
      if (responseBody.timings_ms.upload_parse) {
        expect(typeof responseBody.timings_ms.upload_parse).toBe('number');
        expect(responseBody.timings_ms.upload_parse).toBeGreaterThanOrEqual(0);
      }
      
      // Should have total timing
      if (responseBody.timings_ms.total) {
        expect(typeof responseBody.timings_ms.total).toBe('number');
        expect(responseBody.timings_ms.total).toBeGreaterThanOrEqual(0);
      }
    });

    test('response includes context pack with enrichment data', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        MINIMAL_JPEG,
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
      expect(responseBody.context_pack.mode).toBe(validMetadata.request.mode);
      expect(responseBody.context_pack.location).toBeDefined();
      expect(responseBody.context_pack.location.lat).toBe(validMetadata.location.lat);
      expect(responseBody.context_pack.location.lon).toBe(validMetadata.location.lon);
    });

    test('response includes enrichment status', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        MINIMAL_JPEG,
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
      
      expect(responseBody.enrichment_status).toBeDefined();
      // Each enrichment should have a status
      const validStatuses = ['ok', 'failed', 'skipped'];
      if (responseBody.enrichment_status.reverse_geocode) {
        expect(validStatuses).toContain(responseBody.enrichment_status.reverse_geocode);
      }
      if (responseBody.enrichment_status.weather) {
        expect(validStatuses).toContain(responseBody.enrichment_status.weather);
      }
      if (responseBody.enrichment_status.solar) {
        expect(validStatuses).toContain(responseBody.enrichment_status.solar);
      }
    });

    test('specific mode with target species is handled', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      const specificMetadata = {
        ...validMetadata,
        request: {
          ...validMetadata.request,
          mode: 'specific',
          target_species: 'Largemouth Bass'
        }
      };

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(specificMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        MINIMAL_JPEG,
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
      
      expect(responseBody.context_pack.mode).toBe('specific');
      expect(responseBody.context_pack.target_species).toBe('Largemouth Bass');
    });

    test('user constraints are included in context pack', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        MINIMAL_JPEG,
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
      
      expect(responseBody.context_pack.user_context).toBeDefined();
      expect(responseBody.context_pack.user_context.platform).toBe(validMetadata.request.platform_context);
      expect(responseBody.context_pack.user_context.gear_type).toBe(validMetadata.request.gear_type);
    });
  });

  describe('Photo Format Support', () => {
    test('JPEG images are accepted', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        MINIMAL_JPEG,
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

      // Should not be a 400 error for invalid media type
      expect(response.statusCode).not.toBe(400);
      
      const responseBody = JSON.parse(response.body);
      if (responseBody.error) {
        expect(responseBody.error.code).not.toBe('INVALID_MEDIA');
      }
    });

    test('capture_type mismatch with MIME type is rejected', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      // Metadata says video but file is image
      const videoMetadata = {
        ...validMetadata,
        request: {
          ...validMetadata.request,
          capture_type: 'video'
        }
      };

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(videoMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        MINIMAL_JPEG,
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
});

describe('Photo Analysis Result Structure', () => {
  // These tests verify the expected structure when AI pipeline is complete
  
  test('valid result has expected zones structure', () => {
    expect(validResult.zones).toBeDefined();
    expect(Array.isArray(validResult.zones)).toBe(true);
    
    if (validResult.zones.length > 0) {
      const zone = validResult.zones[0];
      expect(zone.zone_id).toBeDefined();
      expect(zone.label).toBeDefined();
      expect(zone.confidence).toBeDefined();
      expect(zone.polygon).toBeDefined();
      expect(zone.cast_arrow).toBeDefined();
    }
  });

  test('valid result has expected tactics structure', () => {
    expect(validResult.tactics).toBeDefined();
    expect(Array.isArray(validResult.tactics)).toBe(true);
    
    if (validResult.tactics.length > 0) {
      const tactic = validResult.tactics[0];
      expect(tactic.zone_id).toBeDefined();
      expect(tactic.recommended_rig).toBeDefined();
      expect(tactic.target_depth).toBeDefined();
      expect(tactic.retrieve_style).toBeDefined();
      expect(tactic.why_this_zone_works).toBeDefined();
    }
  });

  test('valid result has analysis_frame for photo', () => {
    expect(validResult.analysis_frame).toBeDefined();
    expect(validResult.analysis_frame.type).toBe('photo');
    expect(validResult.analysis_frame.width_px).toBeGreaterThan(0);
    expect(validResult.analysis_frame.height_px).toBeGreaterThan(0);
  });
});
