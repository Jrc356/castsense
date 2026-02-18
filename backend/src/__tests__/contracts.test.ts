/**
 * Contract Tests (T11.1)
 * 
 * Tests for request/response JSON schema validation.
 * Validates that API responses conform to contracts/*.schema.json
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

import analyzeRoutes from '../routes/analyze';
import healthRoutes from '../routes/health';

// Load schemas
const schemasDir = path.resolve(__dirname, '../../../contracts');
const responseSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'response.schema.json'), 'utf-8'));
const errorSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'error.schema.json'), 'utf-8'));
const metadataSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'metadata.schema.json'), 'utf-8'));
const resultSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'result.schema.json'), 'utf-8'));

// Initialize AJV
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validateResponse = ajv.compile(responseSchema);
const validateError = ajv.compile(errorSchema);
const validateMetadata = ajv.compile(metadataSchema);
const validateResult = ajv.compile(resultSchema);

// Load fixtures
const validMetadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/valid-metadata.json'), 'utf-8')
);
const invalidMetadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/invalid-metadata.json'), 'utf-8')
);
const validResult = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/valid-result.json'), 'utf-8')
);
const invalidResult = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/invalid-result.json'), 'utf-8')
);

// Minimal valid JPEG (1x1 pixel red image)
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

describe('Contract Tests (T11.1)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
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
  });

  describe('Schema Validation', () => {
    test('valid metadata fixture conforms to metadata schema', () => {
      const valid = validateMetadata(validMetadata);
      expect(valid).toBe(true);
      if (!valid) {
        console.error('Metadata validation errors:', validateMetadata.errors);
      }
    });

    test('invalid metadata fixture fails metadata schema', () => {
      const valid = validateMetadata(invalidMetadata);
      expect(valid).toBe(false);
      expect(validateMetadata.errors).toBeDefined();
      expect(validateMetadata.errors!.length).toBeGreaterThan(0);
    });

    test('valid result fixture conforms to result schema', () => {
      const valid = validateResult(validResult);
      expect(valid).toBe(true);
      if (!valid) {
        console.error('Result validation errors:', validateResult.errors);
      }
    });

    test('invalid result fixture fails result schema', () => {
      const valid = validateResult(invalidResult);
      expect(valid).toBe(false);
    });
  });

  describe('Health Endpoint', () => {
    it('GET /v1/health returns proper status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body.status).toBe('ok');
    });
  });

  describe('Analyze Endpoint Error Responses', () => {
    test('missing metadata returns INVALID_MEDIA error', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      // Create multipart body with only media, no metadata
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
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
      
      // Validate error response shape
      expect(responseBody).toHaveProperty('request_id');
      expect(responseBody).toHaveProperty('status', 'error');
      expect(responseBody).toHaveProperty('error');
      expect(responseBody.error).toHaveProperty('code', 'INVALID_MEDIA');
      expect(responseBody.error).toHaveProperty('message');
      expect(responseBody.error).toHaveProperty('retryable', false);
    });

    test('invalid metadata JSON returns INVALID_MEDIA error', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(invalidMetadata)),
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
      
      expect(responseBody.status).toBe('error');
      expect(responseBody.error.code).toBe('INVALID_MEDIA');
      expect(responseBody.error).toHaveProperty('details');
    });

    test('unsupported MIME type returns INVALID_MEDIA error', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(validMetadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="media"; filename="test.gif"\r\n'),
        Buffer.from('Content-Type: image/gif\r\n\r\n'),
        Buffer.from('GIF89a'), // Fake GIF header
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
      
      expect(responseBody.status).toBe('error');
      expect(responseBody.error.code).toBe('INVALID_MEDIA');
      expect(responseBody.error.message).toContain('Unsupported media type');
    });

    test('missing location returns NO_GPS error', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      // Metadata without location
      const metadataWithoutLocation = {
        client: validMetadata.client,
        request: validMetadata.request
        // location intentionally omitted
      };

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="metadata"\r\n\r\n'),
        Buffer.from(JSON.stringify(metadataWithoutLocation)),
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
      
      expect(responseBody.status).toBe('error');
      expect(responseBody.error.code).toBe('NO_GPS');
      expect(responseBody.error.message).toContain('Location required');
      expect(responseBody.error.retryable).toBe(false);
    });

    test('valid analyze request returns envelope with required fields', async () => {
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

      // Currently returns 501 as AI pipeline is not implemented
      // But envelope structure should be valid
      const responseBody = JSON.parse(response.body);
      
      // Required envelope fields per response.schema.json
      expect(responseBody).toHaveProperty('request_id');
      expect(typeof responseBody.request_id).toBe('string');
      expect(responseBody).toHaveProperty('status');
      expect(['ok', 'degraded', 'error']).toContain(responseBody.status);
      
      // Optional but expected fields
      if (responseBody.timings_ms) {
        expect(typeof responseBody.timings_ms).toBe('object');
      }
      
      if (responseBody.context_pack) {
        expect(typeof responseBody.context_pack).toBe('object');
        expect(responseBody.context_pack).toHaveProperty('mode');
      }
    });

    test('error response conforms to error schema', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      // Empty body to trigger error
      const body = Buffer.concat([
        Buffer.from(`--${boundary}--\r\n`)
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
      
      // Validate against error schema structure
      expect(responseBody).toHaveProperty('request_id');
      expect(responseBody).toHaveProperty('status', 'error');
      expect(responseBody).toHaveProperty('error');
      expect(responseBody.error).toHaveProperty('code');
      expect(responseBody.error).toHaveProperty('message');
      expect(responseBody.error).toHaveProperty('retryable');
      expect(typeof responseBody.error.retryable).toBe('boolean');
    });
  });

  describe('Response Schema Compliance', () => {
    test('response envelope matches response schema structure', () => {
      // Create a mock response that should pass
      const mockResponse = {
        request_id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'ok',
        rendering_mode: 'overlay',
        timings_ms: {
          upload: 50,
          enrichment: 200,
          ai_perception: 1500,
          ai_planning: 800,
          validation: 100,
          total: 2650
        },
        enrichment_status: {
          reverse_geocode: 'ok',
          weather: 'ok',
          solar: 'ok'
        },
        context_pack: {
          mode: 'general',
          target_species: null
        },
        result: validResult
      };

      const valid = validateResponse(mockResponse);
      expect(valid).toBe(true);
      if (!valid) {
        console.error('Response validation errors:', validateResponse.errors);
      }
    });
  });
});
