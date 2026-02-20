<!-- Copilot Backend Instructions for CastSense -->
# CastSense Backend — Copilot Instructions

**Scope:** Fastify API, type generation, enrichment services, AI integration  
**Reference:** See [.github/copilot-instructions.md](.github/copilot-instructions.md) for full architecture overview.

## Quick Start

```bash
make up                      # Start backend in Docker (port 3000)
make backend-test            # Run tests
make backend-lint            # Run ESLint + tsc --noEmit
make backend-shell           # Shell in backend container
make backend-logs            # View logs
make contracts-generate-types # Generate types from schemas
```

## Architecture

### Server Setup

[backend/src/index.ts](backend/src/index.ts#L1) — Fastify 4.26

**Initialization flow:**
1. Load config → fails fast if env vars missing
2. Register middleware in order (CORS → multipart → rate-limit → auth → hardening)
3. Register routes
4. Graceful shutdown on SIGTERM/SIGINT

**Config validation:** [backend/src/config/schema.ts](backend/src/config/schema.ts#L1)
- Helper functions: `requireString()`, `requireInt()`, `requireBoolean()`, `requireEnum()`
- Collects all errors and throws summary
- **Required vars:** `AI_PROVIDER_API_KEY`, `WEATHER_API_KEY`, `GEOCODE_API_KEY`
- **Optional:** `HYDROLOGY_API_KEY`, storage, custom API key

### Request Flow

```
POST /v1/analyze (multipart: media + metadata JSON)
  ↓
[Media Processing]
  - Extract orientation, resize, validate format
  - Select best frame (photos: single, videos: keyframe selection)
  ↓
[Enrichment] (parallel, 2s timeout per task)
  - Reverse geocode (GPS → address)
  - Fetch weather
  - Calculate solar position
  - Hydrology API (optional)
  - Returns: context pack with status map (failures tolerated)
  ↓
[AI Integration]
  - Builds full prompt (perception + planning stages)
  - Calls OpenAI-compatible provider
  - Timeout: 12s (photo), 18s (video)
  ↓
[Validation]
  - Validates output against result.schema.json
  - Returns: CastSenseResponseEnvelope with overlay zones
  ↓
Response { request_id, overlay_zones, tactics, timing }
```

### Middleware Stack (ORDER MATTERS)

[backend/src/middleware/](backend/src/middleware/)

1. **CORS** — Preflight handling, credentials
2. **Multipart Parser** — Handles media file upload
3. **Auth** — Bearer token validation
   - Constant-time comparison (timing attack prevention)
   - Public routes: `/v1/health`
4. **Rate Limiter** — Per-API-key RPM + concurrency
5. **Input Hardening** — Payload size, type validation

⚠️ **Changing order breaks auth and rate limiting.**

### Services (Feature-Based Organization)

#### Media Processing

[backend/src/services/media-storage.ts](backend/src/services/media-storage.ts#L1)
```typescript
saveMedia(buffer: Buffer, ext: string): { path: string; cleanup: () => Promise<void> }
```

[backend/src/services/image-processor.ts](backend/src/services/image-processor.ts#L1)
```typescript
normalizeImage(path: string): Promise<{ width, height, format }>
```
- Handles EXIF orientation
- Resizes to max 2048px
- Output: sharp processed image

[backend/src/services/video-processor.ts](backend/src/services/video-processor.ts#L1)
```typescript
getVideoDuration(path: string): Promise<number>
getVideoKeyframes(path: string): Promise<Buffer[]>
```
- Uses ffmpeg
- Extracts 3-5 keyframes for analysis

[backend/src/services/analysis-frame.ts](backend/src/services/analysis-frame.ts#L1)
```typescript
selectAnalysisFrame(media: MediaFile): Promise<Buffer>
```
- Photos: returns original (after normalization)
- Videos: picks best keyframe

#### Enrichment Orchestration

[backend/src/services/enrichment/](backend/src/services/enrichment/)

Each enrichment task has **2s timeout** and runs in parallel:

```typescript
const enrichment = await Promise.allSettled([
  enrichGeocode(coords),     // GPS → address
  enrichWeather(coords),     // Weather API
  enrichSolar(coords, time), // Solar position
  enrichHydrology(coords),   // Hydrology (optional)
])

// Returns: { geocode?: data, weather?: data, solar?: data, status: { ... } }
// Continues even if one task fails
```

[backend/src/services/context-pack.ts](backend/src/services/context-pack.ts#L1)
```typescript
buildContextPack(metadata: Metadata, enrichment: Enrichment): ContextPack
```
- Merges metadata + enrichment results
- Builds prompt context for AI
- Status map: which enrichments succeeded/failed

#### AI Integration

[backend/src/services/ai/](backend/src/services/ai/)

OpenAI-compatible provider:
```typescript
analyzeWithAI(
  frame: Buffer,
  context: ContextPack,
  isVideo: boolean
): Promise<CastSenseResult>
```

**Two-stage prompt:**
1. **Perception** — Analyze visual features
2. **Planning** — Generate tactics/zones

**Timeouts:**
- Photos: 12s
- Videos: 18s

Validates output against [contracts/result.schema.json](contracts/result.schema.json#L1) with **strict** mode (no extra fields).

#### Validation

[backend/src/services/validation/](backend/src/services/validation/)

AJV schema validators:
- `validateMetadata()` — Checks incoming request
- `validateResponse()` — Checks AI output
- `validateError()` — Standardized error format

All use `additionalProperties: false` for strictness.

### Routes

#### POST /v1/analyze

[backend/src/routes/analyze.ts](backend/src/routes/analyze.ts#L1)

**Request:** `multipart/form-data`
```
├── media (file): image/jpeg, image/png, video/mp4
└── metadata (JSON): { location, capture_mode, timestamp, ... }
```

**Response:** `application/json`
```typescript
{
  request_id: string,
  status: 'success' | 'error',
  overlay_zones: Array<{ geometry, label, confidence }>,
  tactics: string[],
  timing: { enrichment_ms, ai_ms, total_ms }
}
```

#### GET /v1/health

Public healthcheck (no auth required).

### Error Responses

Standard error envelope:
```typescript
{
  request_id: string,
  status: 'error',
  error: {
    code: 'INVALID_MEDIA' | 'NO_GPS' | 'AI_TIMEOUT' | ...,
    message: string,
    retryable: boolean,
    details?: object
  }
}
```

Example:
```typescript
{
  request_id: 'abc-123',
  status: 'error',
  error: {
    code: 'AI_TIMEOUT',
    message: 'Model inference exceeded 12s timeout',
    retryable: true,
    details: { elapsed_ms: 12050, timeout_ms: 12000 }
  }
}
```

### Request Context & Timing

[backend/src/utils/request-context.ts](backend/src/utils/request-context.ts#L1)

```typescript
const { startTimer, endTimer, finalizeTimings } = createRequestContext()

startTimer('enrichment')
// do enrichment work
endTimer('enrichment')

startTimer('ai')
// call AI
endTimer('ai')

const timings = finalizeTimings()
// { enrichment_ms: 450, ai_ms: 3250, total_ms: 3700 }
```

## Type Generation Pipeline

**Source of truth:** [contracts/](contracts/) JSON Schemas
- `metadata.schema.json` — Request metadata structure
- `response.schema.json` — API response envelope
- `result.schema.json` — AI output (overlay zones, tactics)
- `error.schema.json` — Error responses

**Generate:**
```bash
make contracts-generate-types
```

**Outputs:**
- `backend/src/types/contracts.ts` — Backend types
- `mobile/src/types/contracts.ts` — Mobile types

**Workflow:**
1. Update JSON schema in `contracts/`
2. Run `make contracts-generate-types`
3. Regenerate types: `backend/src/types/contracts.ts`
4. Verify backend compiles: `make backend-lint`
5. Mobile types auto-updated

## Configuration

### Environment Variables

**Required:**
```bash
AI_PROVIDER_API_KEY=sk_...          # OpenAI key
WEATHER_API_KEY=...                 # Weather API
GEOCODE_API_KEY=...                 # Reverse geocode API
CASTSENSE_API_KEY=...               # For auth
RATE_LIMIT_RPM=100                  # Requests per API key per min
```

**Optional:**
```bash
HYDROLOGY_API_KEY=...               # Optional enrichment
OBJECT_STORAGE_BUCKET=...           # S3-compatible
NODE_ENV=development|production
```

**Validation happens at startup** in [backend/src/config/schema.ts](backend/src/config/schema.ts#L1) — missing vars cause immediate failure.

## Testing

### Unit Tests

```bash
make backend-test                    # Run all tests
make backend-test -- --watch         # Watch mode
make backend-test -- --coverage --ci # Full coverage
```

**Structure:** Tests in `src/__tests__/` mirror `src/` structure

**Setup:** [backend/src/__tests__/setup.ts](backend/src/__tests__/setup.ts#L1)
- Jest config
- Fixtures
- Mock setup

**Example:**
```typescript
describe('analyzeMedia', () => {
  it('should process image and return zones', async () => {
    const media = { ... }
    const result = await analyzeRoute.post(media)
    
    expect(result.status).toBe('success')
    expect(result.overlay_zones).toHaveLength(3)
  })
  
  it('should retry on enrichment timeout', async () => {
    // Mock enrichment timeout
    // Verify error.retryable = true
  })
})
```

### Linting & Type Checking

```bash
make backend-lint                    # ESLint + tsc --noEmit
tsc --noEmit                         # Type check only
```

**TypeScript config:** [backend/tsconfig.json](backend/tsconfig.json#L1)
- Strict mode enforced
- No `any` implicit
- `noUnusedLocals`, `noUnusedParameters`

## Common Patterns

### Adding an Enrichment Service

1. **Create service** in `services/enrichment/my-service.ts`:
```typescript
export async function enrichMyData(
  coords: Coordinates,
  signal?: AbortSignal
): Promise<MyDataResult | null> {
  try {
    // 2s timeout enforced by Promise.allSettled
    const data = await fetchData(coords, signal)
    return data
  } catch (err) {
    logger.warn('enrichMyData failed', err)
    return null // Failures tolerated
  }
}
```

2. **Add to orchestration** in `enrichment/index.ts`:
```typescript
export async function enrichContext(
  metadata: Metadata
): Promise<Enrichment> {
  const results = await Promise.allSettled([
    enrichGeocode(...),
    enrichWeather(...),
    enrichSolar(...),
    enrichMyData(...), // ← Add here
  ])
  // Returns: { my_data?: data, status: { ... } }
}
```

3. **Update schema** in `contracts/metadata.schema.json`:
```json
{
  "properties": {
    "my_data_result": { "type": "string" }
  }
}
```

4. **Regenerate types:**
```bash
make contracts-generate-types
```

### Handling Timeouts

**Use `AbortSignal`** (passed by enrichment orchestrator):

```typescript
export async function enrichWeather(
  coords: Coordinates,
  signal?: AbortSignal
): Promise<WeatherData | null> {
  try {
    const response = await fetch(url, { signal })
    return response.json()
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('Weather enrichment timed out')
      return null // Timeout handled gracefully
    }
    throw err
  }
}
```

### Error Responses

Always return structured errors in `analyze` route:

```typescript
// ❌ Wrong
throw new Error('GPS not available')

// ✅ Correct
return fastify.statusCode(400).send({
  status: 'error',
  error: {
    code: 'NO_GPS',
    message: 'Location unavailable: permission denied',
    retryable: false,
  }
})
```

### Rate Limiting

[backend/src/middleware/rate-limiter.ts](backend/src/middleware/rate-limiter.ts#L1)

**Per-API-key tracking:**
```bash
RATE_LIMIT_RPM=100  # 100 requests per API key per minute
```

Rate limiter automatically:
- Tracks by `Authorization: Bearer <key>`
- Returns 429 if exceeded
- Resets per request

No manual code needed — configured at middleware level.

## Debugging

### Config validation fails?

Check [backend/src/config/schema.ts](backend/src/config/schema.ts#L1) for error summary:
```bash
make up  # Shows which vars are missing
```

### Enrichment tasks timeout?

Each task has 2s timeout. Check [services/enrichment/](backend/src/services/enrichment/#L1):
- Verify API endpoints are responding
- Check network connectivity in Docker
- Add `AbortSignal` handling

### Schema validation errors?

- Check request structure matches [contracts/metadata.schema.json](contracts/metadata.schema.json#L1)
- Verify AI output matches [contracts/result.schema.json](contracts/result.schema.json#L1) (strict mode)
- Use `make contracts-generate-types` after schema changes

### Type compilation fails?

```bash
make backend-lint            # Shows type errors
# Then:
make contracts-generate-types  # Regenerate types
tsc --noEmit                 # Verify
```

### Rate limiter triggering unexpectedly?

Check:
- Rate limit value: `RATE_LIMIT_RPM=100`
- API key extraction in auth middleware
- Per-key tracking logic in rate-limiter

### AI request timing out?

- Photo timeout: 12s
- Video timeout: 18s

Check:
- Model response time (logs)
- Network latency to AI provider
- Media processing time (should be <1s)

## Example Prompts for AI Assistance

- "Add a new enrichment service for [data source] with 2s timeout."
- "Implement retry logic for weather API failures."
- "Create a metrics endpoint at GET /v1/metrics returning response times."
- "Fix schema validation: result.schema.json needs stricter type checking."
- "Add request deduplication: same GPS+timestamp within 5min returns cached result."
- "Implement media compression: resize images to max 1920px, videos to 30fps."
- "Add health checks for enrichment APIs in /v1/health."
- "Optimize AI prompt: reduce context pack size by 30% without losing data."

## Links

- [API Routes](backend/src/routes/)
- [Services](backend/src/services/)
- [Middleware](backend/src/middleware/)
- [Config Schema](backend/src/config/schema.ts#L1)
- [Contracts](contracts/)
- [Type Generation](contracts/scripts/generate-types.ts#L1)
- [Tests](backend/src/__tests__/)
- [Main Instructions](../.github/copilot-instructions.md)
