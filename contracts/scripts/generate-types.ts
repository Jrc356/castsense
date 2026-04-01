/**
 * CastSense Type Generation Script
 * 
 * Generates TypeScript types from JSON Schema definitions and outputs
 * to the web and backend projects.
 * 
 * Usage: npm run generate-types
 */

import { compile, JSONSchema } from 'json-schema-to-typescript';
import * as fs from 'fs';
import * as path from 'path';

const CONTRACTS_DIR = path.resolve(__dirname, '..');
const WEB_TYPES_DIR = path.resolve(CONTRACTS_DIR, '../web/src/types');
const BACKEND_TYPES_DIR = path.resolve(CONTRACTS_DIR, '../backend/src/types');

interface SchemaConfig {
  file: string;
  typeName: string;
  description: string;
}

const SCHEMAS: SchemaConfig[] = [
  {
    file: 'metadata.schema.json',
    typeName: 'RequestMetadata',
    description: 'Client to backend request metadata'
  },
  {
    file: 'response.schema.json',
    typeName: 'ResponseEnvelope',
    description: 'API response envelope wrapper'
  },
  {
    file: 'result.schema.json',
    typeName: 'AnalysisResult',
    description: 'Overlay-ready analysis result'
  },
  {
    file: 'error.schema.json',
    typeName: 'ErrorResponse',
    description: 'Standard error response'
  }
];

async function loadSchema(schemaPath: string): Promise<JSONSchema> {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  return JSON.parse(content) as JSONSchema;
}

async function generateTypes(): Promise<string> {
  const generatedTypes: string[] = [];
  
  // Header comment
  generatedTypes.push(`/**
 * CastSense Contract Types
 * 
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * Generated from JSON Schemas in /contracts
 * 
 * To regenerate: cd contracts && npm run generate-types
 */

/* eslint-disable */
/* tslint:disable */
`);

  // Generate types for each schema
  for (const config of SCHEMAS) {
    const schemaPath = path.join(CONTRACTS_DIR, config.file);
    
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema not found: ${schemaPath}`);
      continue;
    }

    console.log(`Generating types for ${config.file}...`);
    
    const schema = await loadSchema(schemaPath);
    
    // Use schema title or provided typeName
    const title = config.typeName;
    
    try {
      const ts = await compile(schema, title, {
        bannerComment: '',
        additionalProperties: false,
        strictIndexSignatures: true,
        cwd: CONTRACTS_DIR,
        declareExternallyReferenced: true,
        $refOptions: {
          resolve: {
            file: {
              read: (file: { url: string }) => {
                const filePath = file.url.replace('file://', '');
                return fs.readFileSync(filePath, 'utf-8');
              }
            }
          }
        }
      });
      
      generatedTypes.push(`// ${config.description}`);
      generatedTypes.push(`// Source: ${config.file}\n`);
      generatedTypes.push(ts);
      generatedTypes.push('\n');
    } catch (err) {
      console.error(`Error generating types for ${config.file}:`, err);
      throw err;
    }
  }

  // Add utility types
  generatedTypes.push(`
// Utility Types

/** Normalized coordinate point [x, y] where values are 0-1 */
export type NormalizedPoint = [number, number];

/** Polygon as array of normalized points */
export type NormalizedPolygon = NormalizedPoint[];

/** Extract zone from result */
export type Zone = CastSenseAnalysisResult['zones'][number];

/** Extract tactic from result */
export type Tactic = CastSenseAnalysisResult['tactics'][number];

/** Status values */
export type ResponseStatus = CastSenseResponseEnvelope['status'];

/** Error codes */
export type ErrorCode = CastSenseErrorResponse['error']['code'];

/** Rendering modes */
export type RenderingMode = NonNullable<CastSenseResponseEnvelope['rendering_mode']>;

/** Fishing modes */
export type FishingMode = 'general' | 'specific';

/** Platform context */
export type PlatformContext = 'shore' | 'kayak' | 'boat';

/** Gear types */
export type GearType = 'spinning' | 'baitcasting' | 'fly' | 'unknown';

/** Capture types */
export type CaptureType = 'photo' | 'video';

// Type aliases for convenience
export type RequestMetadata = CastSenseRequestMetadata;
export type ResponseEnvelope = CastSenseResponseEnvelope;
export type AnalysisResult = CastSenseAnalysisResult;
export type ErrorResponse = CastSenseErrorResponse;
`);

  return generatedTypes.join('\n');
}

async function ensureDir(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

async function main(): Promise<void> {
  console.log('CastSense Type Generation\n');
  console.log('Contracts directory:', CONTRACTS_DIR);
  console.log('Web types output:', WEB_TYPES_DIR);
  console.log('Backend types output:', BACKEND_TYPES_DIR);
  console.log('');

  try {
    // Generate types
    const types = await generateTypes();
    
    // Ensure output directories exist
    await ensureDir(WEB_TYPES_DIR);

    // Write to web
    const webOutput = path.join(WEB_TYPES_DIR, 'contracts.ts');
    fs.writeFileSync(webOutput, types, 'utf-8');
    console.log(`\nWritten: ${webOutput}`);

    // Write to backend (best effort if backend workspace is writable)
    try {
      await ensureDir(BACKEND_TYPES_DIR);
      const backendOutput = path.join(BACKEND_TYPES_DIR, 'contracts.ts');
      fs.writeFileSync(backendOutput, types, 'utf-8');
      console.log(`Written: ${backendOutput}`);
    } catch (backendError) {
      console.warn(`Warning: backend type output skipped (${String(backendError)})`);
    }
    
    console.log('\nType generation complete!');
  } catch (err) {
    console.error('Type generation failed:', err);
    process.exit(1);
  }
}

main();
