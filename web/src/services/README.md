# Services — Reference

Service modules in `src/services/` implement the analysis pipeline and device integrations. All modules are re-exported from `index.ts`.

## `analysis-orchestrator`

Coordinates the full three-stage pipeline: image processing → metadata enrichment → AI analysis. Dispatches progress callbacks to drive UI updates.

Exported: `runAnalysis`, `isRetryable`, `getErrorMessage`

`AnalysisInput.location` is optional. When absent, the enrichment stage returns all-skipped results and the prompt is built without location context. `AnalysisInput.sessionId` is optional; when provided, it is passed to `analyzeWithLangChain` so the result is stored in conversation memory, enabling follow-up questions.

Error codes: `NO_API_KEY` | `NO_GPS` | `INVALID_MEDIA` | `AI_TIMEOUT` | `AI_RATE_LIMITED` | `AI_INVALID_KEY` | `NETWORK_ERROR` | `VALIDATION_ERROR` | `UNKNOWN`

## `langchain-chain`

Wraps the LangChain OpenAI vision call. Builds the prompt, calls the model, and returns a parsed `CastSenseAnalysisResult`.

Exported: `analyzeWithLangChain`, `LangChainError`

## `langchain-followup`

Handles follow-up questions against an existing analysis session using LangChain conversation memory.

`streamFollowUpQuestion` is the primary export used by the UI. It streams response tokens incrementally via an `onChunk` callback and stores the completed exchange in conversation memory via `addTextExchangeToMemory`. `handleFollowUpQuestion` provides a non-streaming fallback that also saves the exchange to memory.

Both functions require an existing session with history. If no history is found for the provided `sessionId`, they return `{ success: false, error: { code: 'NO_HISTORY' } }` without calling the model.

Exported: `streamFollowUpQuestion`, `handleFollowUpQuestion`, `buildFollowUpPrompt`, `mapFollowUpError`

## `langchain-memory`

Manages the per-session LangChain conversation buffer used for follow-up continuity. Sessions are stored in a module-level `Map` and are lost on page reload.

`addToMemory` stores the initial analysis result (as a JSON-serialised `AIMessage`). `addTextExchangeToMemory` appends a plain-text follow-up Q&A pair so subsequent questions see the full conversation history.

Exported: `createSessionId`, `createConversationMemory`, `addToMemory`, `addTextExchangeToMemory`, `getConversationHistory`, `hasHistory`, `getMessageCount`, `clearMemory`, `clearAllMemory`

## `langchain-parsers`

Parses and validates structured output from the AI. Returns a typed `CastSenseAnalysisResult` or throws on malformed responses.

Exported: `hasValidStructure`, `validateGeometry`

## `langchain-prompts`

Constructs system and user prompts for the analysis and follow-up chains.

## `model-discovery`

Fetches available models from the OpenAI API, filters to chat/vision-capable models, and sorts by capability priority (GPT-5 > O-series > GPT-4o > GPT-4 > GPT-3.5).

Exported: `fetchAvailableModels`

## `model-storage`

Persists and loads the user's selected model to/from `localStorage`.

Exported: `loadSelectedModel`, `saveSelectedModel`, `getDefaultModel`

## `api-key-storage`

Persists and loads the BYO OpenAI API key from `localStorage`. See [web/README.md](../../../README.md) for the security implications of this approach.

## `image-processor`

Downscales captured images before sending to the AI to reduce token cost and latency.

Exported: `processImage`, `getImageDimensions`

## `enrichment`

Collects environmental context (GPS location, weather, solar position) to include in the AI request.

Exported: `enrichMetadata`

## `metadata`

Extracts device info, EXIF data, season, and current location from the environment.

Exported: `getDeviceInfo`, `getCurrentLocation`, `extractExifMetadata`, `watchLocation`, `collectMetadata`, `validateMetadata`, `formatLocation`, `isLocationAccurate`, `getSeason`

## `camera`

Captures photos from the device camera and opens the media library picker.

Exported: `capturePhoto`, `pickMediaFromLibrary`, `CameraError`

## `permissions`

Requests and checks camera, microphone, location, and media library permissions.

Exported: `checkAllPermissions`, `isPermissionGranted`, `requestPermission`, and specialised variants for each permission type.
