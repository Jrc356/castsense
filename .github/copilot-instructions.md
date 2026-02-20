<!-- Copilot Instructions for the CastSense workspace -->
# CastSense — Copilot Instructions

Purpose
-------
Provide quick, actionable guidance for AI assistants and contributors to run, test, and reason about this repo.

Quick Start (Docker with Make)
------------------------------
All development is Docker-based. Use the Makefile for common tasks:

```bash
make help                    # Show all available commands
make up                      # Start all services in Docker
make backend-test            # Run backend tests
make contracts-generate-types # Generate types from schemas
make down                    # Stop all services
```

### Backend Development
```bash
make up               # Start backend in Docker
make backend-shell    # Open shell in backend container
make backend-logs     # View backend logs
```

### Mobile Development
```bash
cd mobile
npm install           # Install dependencies
npm start             # Start Expo dev server
npm run ios           # Run on iOS (macOS only)
npm run android       # Run on Android
```

Mobile app uses Expo and auto-detects the backend URL (localhost for simulator, LAN IP for physical devices).

### Type Generation
```bash
make contracts-generate-types
```

This outputs types to both `mobile/src/types/contracts.ts` and `backend/src/types/contracts.ts`.

Tests & CI
----------
- Backend tests: `make backend-test` (runs in Docker via Jest). Full coverage test: `make backend-test -- --coverage --ci`. See [backend/jest.config.js](backend/jest.config.js#L1).
- Mobile tests: can be run with `cd mobile && npm test` (Jest + ts-jest). See [mobile/jest.config.js](mobile/jest.config.js#L1).
- CI pipeline and expectations are in [.github/workflows/ci.yml](.github/workflows/ci.yml#L1).

Docker & Local Compose
----------------------
All development is Docker-based through the Makefile. Use:

```bash
make up            # Start all services (docker-compose.yml + docker-compose.dev.yml)
make down          # Stop all services
make logs          # View service logs
```

The Docker Compose files are located at [docker-compose.yml](docker-compose.yml#L1) and [docker-compose.dev.yml](docker-compose.dev.yml#L1).

Conventions & Notes
-------------------
- Language: TypeScript across backend and mobile. Use `tsc --noEmit` for type checks.
- Testing: Jest with `ts-jest` preset. Backend tests live under `backend/src/__tests__` and mobile tests under `mobile/src/__tests__`.
- Contracts: canonical JSON Schemas in the `contracts/` directory. Types are generated into both `mobile` and `backend`.
- AI flow: backend collects context, enriches weather/geocode/solar, then invokes provider; outputs are strictly validated against `result.schema.json`.
- Mobile: Uses Expo for development. Camera (expo-camera), location (expo-location), permissions (Expo APIs).
- State Management: Mobile uses Context + useReducer pattern with state machine (discriminated union actions).
- Service Architecture: Backend services are grouped by feature (media-processing, enrichment, AI, validation) with index re-exports.
- React Native Performance: Follow vercel-react-native-skills guidelines (list virtualization, stable references, native navigators).

Key Files & Entry Points
------------------------
- Backend entry: [backend/src/index.ts](backend/src/index.ts#L1)
- API routes: [backend/src/routes](backend/src/routes)
- Mobile navigation: [mobile/src/navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx#L1)
- Mobile state machine: [mobile/src/state/machine.ts](mobile/src/state/machine.ts#L1) (defines state + actions)
- Mobile app context: [mobile/src/state/AppContext.tsx](mobile/src/state/AppContext.tsx#L1) (provider + reducer)
- Mobile API client: [mobile/src/services/api.ts](mobile/src/services/api.ts#L1) (axios + retry logic)
- Contracts and schema generation: [contracts/README.md](contracts/README.md#L1)
- Docker compose: [docker-compose.yml](docker-compose.yml#L1)

Mobile State Machine
--------------------
All screen state transitions flow through `AppContext` which manages a state machine (see [mobile/src/state/machine.ts](mobile/src/state/machine.ts#L1)):

```
Idle → ModeSelected → Capturing → Uploading → Analyzing → Results
                                                              ↓
                                                           Error → (retry)
```

**Pattern: Context + useReducer with Discriminated Union Actions**

The global app state is managed by a reducer dispatching discriminated union actions:

```typescript
type AppAction = 
  | { type: 'SELECT_MODE'; mode: 'general' | 'specific' }
  | { type: 'START_CAPTURE' }
  | { type: 'RECEIVE_RESULTS'; data: CastSenseResponseEnvelope }
  | { type: 'HANDLE_ERROR'; error: AppError }
  | { type: 'RETRY' }
```

**Usage: `useApp()` hook provides type-safe dispatchers**

```typescript
const { state, selectMode, startCapture, receiveResults, handleError, retry } = useApp()
```

Helpers in the machine: `canStartCapture(state)`, `canRetry(state)`, `getStateProgress(state)`

**Key:** State machine is ground truth; UI components dispatch actions, never mutate state directly.

API Error Codes & Categorization
---------------------------------
Mobile API client ([mobile/src/services/api.ts](mobile/src/services/api.ts#L1)) categorizes errors with standard codes for UI handling:

| Code | Meaning | Retryable | Example |
|------|---------|-----------|---------|
| `NO_NETWORK` | No internet connection | Yes | Wifi/cellular unavailable |
| `NO_GPS` | Location unavailable | No | Location permission denied or disabled |
| `INVALID_MEDIA` | Media processing failed | No | Corrupted video, bad orientation |
| `AI_TIMEOUT` | Model exceeded time limit | Yes | 12s (photo) or 18s (video) threshold |
| `AUTH_FAILED` | Invalid API key | No | Misconfigured `CASTSENSE_API_KEY` |
| `NETWORK_ERROR` | Request failed (not NO_NETWORK) | Yes | Server timeout, 5xx |
| `PARSE_ERROR` | Response not valid JSON | Yes | Backend returned malformed JSON |

Backend API error envelope: `{ request_id, status, error: { code: string, message: string, retryable: boolean, details?: object } }`

Service Layer Architecture
---------------------------
Backend services are organized by feature (not by technology):

1. **Media Processing** — `image-processor.ts`, `video-processor.ts`, `analysis-frame.ts`
   - Handles orientation, resizing, frame extraction
   - All exported from `services/index.ts`

2. **Enrichment** — `enrichment/` directory (parallel async tasks with 2s timeout per task)
   - Reverse geocode, weather fetch, solar position, hydrology (optional)
   - Returns status map; continues on individual task failure

3. **AI Integration** — `ai/` directory (OpenAI-compatible provider)
   - Two-stage: Perception → Planning
   - Timeouts: 12s (photo), 18s (video)
   - Validates output against `result.schema.json`

4. **Validation** — `validation/` directory (AJV schema validators)
   - `metadata.schema.json`, `response.schema.json`, `result.schema.json`, `error.schema.json`

**Request Flow:** `POST /v1/analyze` → media processing → enrichment → AI → validation → response

Mobile API Configuration (Auto-Detection)
------------------------------------------
The mobile app auto-detects backend URL ([mobile/src/config/api.ts](mobile/src/config/api.ts#L1)):

1. If `EXPO_PUBLIC_API_URL` env var is set → use it (explicit override)
2. If running in simulator → `http://localhost:3000`
3. If running on physical device → detect LAN IP of host machine
4. Fallback: `http://localhost:3000`

This eliminates need to manually update API URLs between dev environments.

How the assistant should help
----------------------------
- Prefer small, targeted changes that follow the repo style (TypeScript, minimal diff).
- Run backend tests locally before proposing CI-related changes.
- When suggesting code changes, include test updates and commands to run them.
- Follow React Native performance guidelines from `.agents/skills/vercel-react-native-skills/AGENTS.md` for mobile work.
- State machine changes require updating both `machine.ts` (state definition) and `AppContext.tsx` (dispatcher).
- API changes require regenerating types: `make contracts-generate-types` (updates both mobile and backend).

Debugging & Troubleshooting
----------------------------

**Backend Issues:**
- Missing env vars? Check `make up` output; `backend/src/config/schema.ts` validates at startup
- Enrichment timeouts? Each enrichment task has 2s timeout; check `services/enrichment/index.ts`
- Type errors? Regenerate: `make contracts-generate-types` (updates `backend/src/types/contracts.ts`)
- Rate limit errors? Verify `RATE_LIMIT_RPM` env var and per-API-key tracking

**Mobile Issues:**
- State stuck? Check `mobile/src/state/machine.ts#L1` for valid transitions from current state
- API 401? Verify `CASTSENSE_API_KEY` in `.env` (or equivalent)
- Simulator can't reach backend? Check auto-detection in `mobile/src/config/api.ts`; may need `EXPO_PUBLIC_API_URL`
- Camera not working? Verify `expo-camera` permissions in `app.json` and iOS/Android configs

**Type Errors After Schema Changes:**
```bash
make contracts-generate-types  # Regenerates both mobile and backend types
make backend-lint              # Check type compliance
cd mobile && npm run typecheck # Check mobile types
```

**Backend Middleware Order:**
Middleware is loaded in strict order (see [backend/src/index.ts](backend/src/index.ts#L1)):
1. CORS (preflight handling)
2. Auth (Bearer token)
3. Rate limiting (per-API-key RPM + concurrency)
4. Input hardening (payload size/type)

Public routes bypass auth: `/v1/health`

Example Prompts
---------------
- "Run the backend unit tests and report failing tests and traces."
- "Add a small helper to validate AI outputs against `result.schema.json` and tests." 
- "Create an endpoint to return Docker health status and add tests."
- "Implement a new enrichment service for [data source] following the 2s timeout pattern."
- "Fix the mobile state machine: error state should allow retry on retryable errors only."
- "Optimize the results list for performance (use LegendList, React Compiler guidelines)."
- "Update error handling in ResultsScreen to show specific messages for each API error code."
- "Generate types from schema changes and verify both backend and mobile compile."

Suggested Agent Customizations
-----------------------------
- `create-integration-agent` — automates running backend tests, lint, and typecheck, then opens a PR with fixes.
- `generate-contract-types` — runs `contracts/scripts/generate-types.ts` and commits type updates to both `mobile` and `backend`.
- `test-and-fix-mobile` — runs mobile tests with coverage, identifies flaky tests, and suggests optimizations from React Native skills.
- `state-machine-reviewer` — validates mobile state transitions against `machine.ts` before merging state-related PRs.

Where to ask for help
---------------------
- Open an issue or draft PR with reproducible steps. Include failing test output and relevant logs.

Maintainers: see `README.md` for architecture and config details.
