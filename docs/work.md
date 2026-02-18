## 0) Repo + Foundations

### T0.1 — Create monorepo skeleton and local dev workflow

**Goal:** Establish a working repo structure for `mobile/` (React Native) and `backend/` (API), plus shared docs/contracts.
**Deliverables:**

* Repo layout: `mobile/`, `backend/`, `contracts/`, `docs/`
* Root `README` with local dev steps
* Basic env templates: `.env.example` for backend; `.env.*` guidance for mobile
* CI placeholder (lint/test)
  **Spec refs:** §2.1 Components, §3.1 Mobile Technology, §3.2 Backend Technology, §15.1 Configuration

### T0.2 — Define canonical JSON Schemas as files in `contracts/`

**Goal:** Convert the response/result and error contracts into authoritative JSON Schema files used by backend validation + optionally client typing.
**Deliverables:**

* `contracts/metadata.schema.json` (client → backend metadata)
* `contracts/response.schema.json` (response envelope)
* `contracts/result.schema.json` (overlay-ready result)
* `contracts/error.schema.json` (standard error response)
* Schema README documenting versioning and compatibility expectations
  **Spec refs:** §7 API, §8 Context Pack, §9 AI Output Schema, §10 Error Handling, §17 Schema Fragments

### T0.3 — Shared type generation (optional but recommended)

**Goal:** Generate TypeScript types from JSON Schemas for mobile and backend correctness.
**Deliverables:**

* Typegen script (e.g., `contracts/scripts/generate-types`)
* Output to `mobile/src/types/contracts.ts` and `backend/src/types/contracts.ts`
* CI step to ensure schemas and generated types are in sync
  **Spec refs:** §7.4 Response envelope, §9 Result schema, §10 Error response

---

## 1) Backend API (Core Service)

### T1.1 — Implement `/v1/health` endpoint

**Goal:** Basic health check endpoint.
**Deliverables:**

* `GET /v1/health` returns `200` with minimal JSON
* Includes build/version info if available
  **Spec refs:** §7.1 Endpoint Summary

### T1.2 — Implement auth middleware (API key)

**Goal:** Enforce `Authorization: Bearer <API_KEY>` for all v1 endpoints (except health if desired).
**Deliverables:**

* Middleware that checks header and compares against env-configured allowlist or single key
* Proper 401 error response using standard error envelope
  **Spec refs:** §12.1 Authentication, §10.1 Standard Error Response

### T1.3 — Implement request parsing for `POST /v1/analyze` (multipart)

**Goal:** Accept `media` file + `metadata` JSON string; parse, validate, and normalize.
**Deliverables:**

* Multipart parser that extracts:

  * `media` (required)
  * `metadata` (required JSON string)
* Validate metadata against `contracts/metadata.schema.json`
* Return `INVALID_MEDIA` or `UNKNOWN` errors using standard format on failure
  **Spec refs:** §7.2 Request, §10 Error Handling, §16 Backend acceptance criteria

### T1.4 — Enforce content-type allowlist and size caps

**Goal:** Reject unsupported MIME types and oversized uploads.
**Deliverables:**

* MIME allowlist enforcement:

  * Photos: `image/jpeg`, `image/heic` (optional), `image/png` (optional)
  * Video: `video/mp4`, `video/quicktime` (optional)
* Max bytes enforced for photo/video using env:

  * `MAX_PHOTO_BYTES`, `MAX_VIDEO_BYTES`
* Return `INVALID_MEDIA` error with `retryable=false`
  **Spec refs:** §7.3 Request Limits, §12.3 Media Handling

### T1.5 — Generate `request_id` and timings scaffold in response envelope

**Goal:** Ensure every request returns a `request_id` and captures stage timings.
**Deliverables:**

* `request_id` generation (UUID)
* Start/end timestamps for:

  * upload parse, enrichment, keyframes, AI calls, validation, total
* Response envelope contains `timings_ms` per §7.4
  **Spec refs:** §7.4 Response envelope, §11 Observability

---

## 2) Backend Media Handling + Video Keyframes

### T2.1 — Implement transient media storage strategy

**Goal:** Store uploaded media temporarily (disk for dev) with deletion on completion.
**Deliverables:**

* Temporary storage module that:

  * Writes media to ephemeral disk path (v1 dev)
  * Supports optional object store path with TTL hooks (flag-driven)
* Always best-effort delete after processing (success or error)
  **Spec refs:** §3.2 Temporary Media Storage, §4.3 Privacy, §12.3 Media Handling, §6.1 Responsibilities

### T2.2 — Implement photo preprocessing (server-side)

**Goal:** Ensure photos are in a format/size suitable for AI and consistent analysis frame dims.
**Deliverables:**

* Read image dimensions
* Optional downscale long edge to controlled size (e.g., <= 1920)
* Produce analysis frame metadata: width/height
  **Spec refs:** §5.1 Capture (recommended caps), §9.1 `analysis_frame`

### T2.3 — Implement video keyframe extraction (3 frames @ 20/50/80%)

**Goal:** For video requests, extract representative frames and record frame timestamps.
**Deliverables:**

* Keyframe extraction module:

  * Extract N=3 frames at 20%, 50%, 80% of duration
  * Save as JPEG long edge ~1280
  * Output: `frames[]` with paths, `timestamp_ms`, and dimensions
* Hard bounds: execution time budgeted, failures degrade gracefully
  **Spec refs:** §13.1 Keyframe Extraction, §6.1 Responsibilities, §4.2 Reliability

### T2.4 — Define “analysis frame” selection contract for video

**Goal:** Ensure response indicates which frame overlays map to.
**Deliverables:**

* Backend contract: AI returns `analysis_frame.selected_frame_index` and `frame_timestamp_ms`
* If AI omits it, backend defaults to middle frame (index 1) and marks degraded
* Response includes `analysis_frame.type="video_frame"` plus width/height
  **Spec refs:** §2.2 Video flow, §9.1 `analysis_frame`, §13.2 AI input strategy

---

## 3) Backend Context Pack + Enrichment

### T3.1 — Implement canonical context pack builder

**Goal:** Create backend-owned `context_pack` from metadata + enrichment outputs.
**Deliverables:**

* Canonical builder that:

  * Copies mode/target_species/platform/gear/constraints
  * Normalizes location/time objects
  * Adds `species_context` placeholder per schema
* Returned in response envelope as `context_pack`
  **Spec refs:** §6.1 Responsibilities, §8 Canonical Context Pack, §7.4 Response envelope

### T3.2 — Implement reverse geocode module (best-effort with timeout)

**Goal:** Resolve waterbody/place hints; must not block overall request.
**Deliverables:**

* Reverse geocode module with:

  * Soft timeout `ENRICHMENT_TIMEOUT_MS` (default 2s)
  * Returns either data or error object
* Populate `context_pack.location.waterbody_name`, `admin_area`, `country` when available
* Update `enrichment_status.reverse_geocode`
  **Spec refs:** §6.2 Enrichment Strategy, §7.4 `enrichment_status`, §4.2 Reliability

### T3.3 — Implement weather module (best-effort with timeout)

**Goal:** Fetch wind/temp/cloud/precip/pressure.
**Deliverables:**

* Weather enrichment module with soft timeout
* Populate `context_pack.weather` as available; set unknowns explicitly
* Update `enrichment_status.weather`
  **Spec refs:** §6.2 Enrichment Strategy, §8 `weather`, §4.2 Reliability

### T3.4 — Implement solar calculation module (local compute)

**Goal:** Compute sunrise/sunset/daylight phase from lat/lon/timezone.
**Deliverables:**

* Solar module that:

  * Computes sunrise/sunset for the date and location
  * Derives `daylight_phase` enum
  * Sets `season` based on lat + month (reasonable heuristic)
    **Spec refs:** §6.2 Solar, §8 `time`, §2.1 Components

### T3.5 — Implement enrichment fan-out orchestration

**Goal:** Run reverse geocode + weather + solar in parallel with per-provider soft timeouts and overall continuity.
**Deliverables:**

* Parallel execution orchestrator (async fan-out)
* Aggregates results + sets `status="degraded"` when any provider fails
* Always proceeds to AI even if some enrichment fails
  **Spec refs:** §6.2 Parallel fan-out, §4.2 Reliability, §7.4 status semantics

### T3.6 — Implement “missing location” handling

**Goal:** If `lat/lon` absent (permissions not granted), return actionable error.
**Deliverables:**

* Detect missing location fields
* Return error `{ code: "NO_GPS", retryable: false }` and message prompting client to request GPS permission
  **Spec refs:** §7.2 Notes (location required when permissions granted), §5.3 Error states, §10.1 error codes

---

## 4) AI Orchestration + Prompting

### T4.1 — Implement AI provider client wrapper

**Goal:** Single module to call a multimodal model with structured output expectations.
**Deliverables:**

* AI client wrapper with:

  * API key via `AI_PROVIDER_API_KEY`
  * Timeouts: `AI_TIMEOUT_MS_PHOTO`, `AI_TIMEOUT_MS_VIDEO`
  * Model identifier captured for logs/metrics
* Supports multimodal inputs:

  * photo: single image
  * video: multiple frames or contact sheet
    **Spec refs:** §3.3 AI constraints, §6.1 responsibilities, §11.2 logs, §15.1 env vars

### T4.2 — Implement one-stage prompting (v1 initial)

**Goal:** Produce final overlay-ready JSON directly from media + context pack.
**Deliverables:**

* Prompt template enforcing:

  * JSON-only output (§14.1)
  * Schema adherence (§9 + §17)
  * Mode behavior (§14.2)
  * Safety note inclusion when relevant (§14.3)
* For video: include ordered frames and request `selected_frame_index`
  **Spec refs:** §14 Prompting Requirements, §9 Result Schema, §2.2 Video flow

### T4.3 — Add two-stage orchestration (Perception → Planning)

**Goal:** Implement recommended two-stage flow and allow configuration to enable/disable.
**Deliverables:**

* Stage 1 “Perception” prompt returns structured observations
* Stage 2 “Planning” prompt uses observations + full context pack
* Timings stored separately (`ai_perception`, `ai_planning`)
* Config flag to toggle one-stage vs two-stage
  **Spec refs:** §6.3 Two-Stage AI, §7.4 timings_ms, §15.2 Release strategy phase 3

### T4.4 — Implement AI timeout and retry classification

**Goal:** Handle `AI_TIMEOUT` as retryable for client (and possibly server).
**Deliverables:**

* Detect AI call timeouts → return standard error with code `AI_TIMEOUT`, `retryable=true`
* Ensure backend total hard timeout is enforced (<= 20s configurable)
  **Spec refs:** §4.1 timeouts, §7.3 processing time, §10.2 retry guidance

---

## 5) Validation + Repair + Fallback

### T5.1 — Implement JSON Schema validation for AI result

**Goal:** Validate AI output strictly against `contracts/result.schema.json` and envelope semantics.
**Deliverables:**

* Parse AI output as JSON-only (reject surrounding prose per §14.1)
* Validate required fields and types
* Capture validation errors in a structured list for repair + logs
  **Spec refs:** §6.4 Validation layers (1), §14.1 JSON only, §17 Schema fragments

### T5.2 — Implement numeric bounds + geometry sanity checks

**Goal:** Enforce `[0..1]` coords, polygon min points, basic integrity limits.
**Deliverables:**

* Bounds checks for:

  * polygon points
  * cast_arrow start/end
  * retrieve_path points
* Geometry checks:

  * polygon >= 3 points
  * zones length capped to 1–3
* Confidence fields 0..1
  **Spec refs:** §6.4 Validation layers (2)(3)(6), §9.2 Constraints

### T5.3 — Implement referential integrity checks between zones and tactics

**Goal:** Ensure `tactics[].zone_id` exists in `zones[].zone_id`.
**Deliverables:**

* Validator that checks zone IDs match
* Errors are included in repair prompt
  **Spec refs:** §6.4 Validation layers (4), §9.2 Constraints

### T5.4 — Implement single repair attempt

**Goal:** If invalid, call AI once with exact validation errors and request minimal edits.
**Deliverables:**

* Repair prompt template:

  * Includes original JSON + validation errors
  * Requests minimal diff to satisfy schema
* Only one attempt
* Track repair success metric counters
  **Spec refs:** §6.4 Repair policy, §4.2 Reliability, §11.1 metrics (invalid output + repair rate)

### T5.5 — Implement text-only fallback response assembly

**Goal:** If still invalid after repair, return `rendering_mode="text_only"` with tactical plan but no geometry.
**Deliverables:**

* Fallback builder that returns:

  * `result.zones=[]`
  * `tactics` with `zone_id="N/A"`
  * `plan_summary`
* Envelope `status="degraded"` and `rendering_mode="text_only"`
  **Spec refs:** §6.4 fallback, §9.3 Text-only schema, §7.4 envelope semantics

---

## 6) Rate Limiting + Security Hardening

### T6.1 — Implement rate limiting per API key (RPM + concurrency)

**Goal:** Enforce per-key request/minute and concurrent request caps; return 429 w/ retry-after.
**Deliverables:**

* Rate limiting middleware using env:

  * `RATE_LIMIT_RPM`, `RATE_LIMIT_CONCURRENCY`
* `429` response with standard error envelope and `retryable=true`
* Include `Retry-After` header
  **Spec refs:** §12.2 Rate limiting, §10.1 errors, §15.1 env vars

### T6.2 — Implement CORS policy (if any web endpoints exist)

**Goal:** Ensure strict CORS configuration (mobile is not CORS-bound, but keep safe defaults).
**Deliverables:**

* CORS middleware configured to deny by default or allow configured origins only
  **Spec refs:** §4.4 Security (Strict CORS)

### T6.3 — Implement structured input hardening

**Goal:** Guardrails against malformed inputs and large payloads.
**Deliverables:**

* Content-type enforcement
* Metadata JSON parse errors return clean `INVALID_MEDIA` or `UNKNOWN`
* Upload size caps enforced early
  **Spec refs:** §4.4 Security, §7.3 limits, §12.3 media handling

---

## 7) Observability (Metrics, Logs, Tracing)

### T7.1 — Add structured logging per request (sanitized)

**Goal:** Log one record per request without raw media or precise location by default.
**Deliverables:**

* Log fields per §11.2:

  * request_id, timings, app version/platform, mode/capture_type
  * enrichment statuses
  * AI model identifier + response size
  * validation failure types
* Location logging gated behind `LOG_LOCATION_ENABLED` and if enabled round/coarsen lat/lon
  **Spec refs:** §11.2 logs, §4.3 privacy, §15.1 LOG_LOCATION_ENABLED

### T7.2 — Add metrics instrumentation

**Goal:** Collect minimum metrics set and expose endpoint for scraping/collection.
**Deliverables:**

* Counters:

  * request count by `ok|degraded|error`
  * enrichment success/failure per provider
  * invalid output + repair success
  * error codes distribution
* Histograms/timers:

  * total latency and stage latencies
  * payload sizes
  * keyframes extracted count
    **Spec refs:** §11.1 metrics

### T7.3 — Add tracing spans for key stages

**Goal:** Tracing across upload parsing, enrichment fan-out, keyframe extraction, AI calls, validation/repair.
**Deliverables:**

* Trace spans per §11.3
* Correlate traces with `request_id`
  **Spec refs:** §11.3 tracing

---

## 8) Mobile App (React Native)

### T8.1 — Initialize React Native app with core libraries

**Goal:** Set up RN app with camera, location, networking, and overlay rendering baseline.
**Deliverables:**

* RN project scaffolding
* Install + configure:

  * `react-native-vision-camera` (§3.1)
  * geolocation library
  * `@shopify/react-native-skia` (preferred) (§3.1)
  * networking (`fetch` or `axios`) (§3.1)
* Permissions setup (camera, mic, location, photo library if needed)
  **Spec refs:** §3.1 Mobile tech, §5.1 Capture, §5.3 Client state machine

### T8.2 — Implement client state machine and navigation scaffolding

**Goal:** Implement `Idle → ModeSelected → Capturing → Uploading → Analyzing → Results → Error` with clean transitions.
**Deliverables:**

* State machine model (simple reducer is fine)
* Screens:

  * Mode selection (General vs Specific)
  * Capture screen (photo/video toggle)
  * Results screen (overlay + tactics)
  * Error screen/inline error panel
    **Spec refs:** §5.3 Client State Machine, §16 Client acceptance criteria

### T8.3 — Implement capture flow for photo (downscale and upload-ready format)

**Goal:** Capture photo and ensure size/dim caps before upload.
**Deliverables:**

* Photo capture via Vision Camera
* Pre-upload processing:

  * cap long edge 1280–1920px
  * JPEG preferred
    **Spec refs:** §5.1 Photo capture requirements, §2.2 data flow

### T8.4 — Implement capture flow for video (5–10s, 720p cap)

**Goal:** Capture 5–10s video; ensure resolution and size caps to meet backend limits.
**Deliverables:**

* Video capture with duration cap UX
* Ensure resolution cap target 720p (or best effort)
* Show file size and block if exceeds config limit (aligned with backend §7.3)
  **Spec refs:** §5.1 Video requirements, §7.3 Request limits

### T8.5 — Implement metadata collection and schema compliance

**Goal:** Build `metadata` JSON per §7.2 including client + request + location + constraints.
**Deliverables:**

* Collect:

  * client: platform/app_version/device_model/locale/timezone
  * request: mode/target_species/platform_context/gear_type/capture_type/timestamp_utc
  * location: lat/lon/accuracy/etc when granted
  * user_constraints: lures/line_test/notes
* Serialize to JSON string for multipart upload
  **Spec refs:** §7.2 metadata schema, §5.3 error states (NO GPS)

### T8.6 — Implement upload client for `POST /v1/analyze` (multipart + auth)

**Goal:** Upload media + metadata with API key header and handle responses.
**Deliverables:**

* Multipart request builder
* `Authorization: Bearer <API_KEY>` header
* Timeout handling + one retry rules:

  * retry once for `AI_TIMEOUT` and `ENRICHMENT_FAILED` if retryable=true (§10.2)
* Parse response envelope and route to Results or Error states
  **Spec refs:** §7.2 request, §10.2 retry guidance, §12.1 auth

---

## 9) Mobile Overlay Rendering + Interaction

### T9.1 — Implement normalized coordinate mapping for contain/cover

**Goal:** Map `[0..1]` result coordinates to screen coordinates accounting for aspect ratio and letterboxing.
**Deliverables:**

* Utility function:

  * inputs: image intrinsic size, displayed rect size, fit mode (contain/cover)
  * outputs: transform from normalized → screen coordinates
* Unit tests with known cases (letterboxing offsets)
  **Spec refs:** §5.2 Coordinate mapping, §3.3 constraints normalized coords

### T9.2 — Render polygon zones, cast arrows, retrieve paths

**Goal:** Draw overlay primitives exactly as required.
**Deliverables:**

* Skia overlay layer rendering:

  * polygon filled + stroked
  * cast arrow with arrowhead
  * retrieve path polyline
* Zone styles using `style.priority` / `style.hint` for subtle differentiation (no hard requirements, but use provided fields)
  **Spec refs:** §5.2 Rendering requirements, §9.1 zones schema

### T9.3 — Implement polygon hit testing + zone selection

**Goal:** Tap a polygon to select zone and update bottom sheet tactics.
**Deliverables:**

* Point-in-polygon hit testing
* Selected zone state
* Bottom sheet that displays `tactics` for selected `zone_id`
  **Spec refs:** §5.2 Zone interaction, §9.1 tactics linkage

### T9.4 — Implement text-only rendering mode UX

**Goal:** If `rendering_mode="text_only"`, show the plan/tactics without overlay.
**Deliverables:**

* Conditional UI path:

  * Show plan_summary, tactics steps, conditions_summary if provided
  * Display “no overlay available” explanation
* Preserve retry UX if status is degraded/error
  **Spec refs:** §7.4 rendering_mode, §6.4 fallback, §5.3 error handling

---

## 10) Error UX + Resilience

### T10.1 — Implement GPS permission error handling and retry path

**Goal:** Provide actionable UX for missing GPS and allow re-run.
**Deliverables:**

* If backend returns `NO_GPS`, prompt user to enable location
* Allow reattempt once permission granted
* Manual retry button
  **Spec refs:** §5.3 Error states, §10.1 error code NO_GPS, §7.2 location notes

### T10.2 — Implement network error handling and retry

**Goal:** Show offline UI and retry.
**Deliverables:**

* Detect network failure and show retry UI
* Ensure state machine transitions cleanly back to Uploading/Analyzing
  **Spec refs:** §5.3 error states (No network), §10.2 retry guidance

### T10.3 — Implement server error / timeout handling

**Goal:** Handle `status=error` envelope and show appropriate retry guidance.
**Deliverables:**

* Render error code + friendly message
* Auto-retry once only for retryable errors as per §10.2
  **Spec refs:** §10.1 Standard error response, §10.2 Retry Guidance

---

## 11) Integration Tests + Contract Tests

### T11.1 — Backend contract tests for request/response schemas

**Goal:** Ensure API behavior matches spec contracts.
**Deliverables:**

* Tests for:

  * valid photo analyze request returns envelope with required fields
  * invalid metadata fails with standard error shape
  * unsupported MIME fails with `INVALID_MEDIA`
  * missing location returns `NO_GPS`
* Validate response JSON against schemas in `contracts/`
  **Spec refs:** §7 API, §10 errors, §16 backend acceptance

### T11.2 — Backend validation/repair unit tests

**Goal:** Hard-test validators and the “single repair then fallback” policy.
**Deliverables:**

* Fixture outputs:

  * invalid coords, missing fields, mismatched zone_id
* Assert:

  * one repair attempt only
  * fallback to text_only when still invalid
    **Spec refs:** §6.4 validation + repair, §9.3 fallback

### T11.3 — Mobile snapshot/integration tests for overlay mapping

**Goal:** Ensure overlays align across aspect ratios and fit modes.
**Deliverables:**

* Tests for normalized → screen mapping
* Golden test cases:

  * portrait photo rendered in landscape container
  * contain vs cover letterboxing differences
    **Spec refs:** §5.2 mapping requirements, §16 client acceptance

### T11.4 — End-to-end “happy path” test (photo)

**Goal:** Validate the full flow from capture → upload → overlay rendering.
**Deliverables:**

* Use a sample image fixture (not camera) for deterministic runs
* Mock backend or use dev backend
* Assert results screen renders zones and tactics
  **Spec refs:** §2.2 Photo flow, §16 acceptance

### T11.5 — End-to-end “happy path” test (video keyframes)

**Goal:** Validate video upload → backend keyframe extraction → selected frame overlay.
**Deliverables:**

* Use a short video fixture
* Confirm response includes `analysis_frame.selected_frame_index` and overlays render against returned frame
* Validate degraded path if extraction fails
  **Spec refs:** §2.2 Video flow, §13 keyframes, §7.4 envelope

---

## 12) Deployment + Configuration

### T12.1 — Backend configuration system and env var wiring

**Goal:** Implement typed config reading all required env vars and defaults.
**Deliverables:**

* Config loader with:

  * `AI_PROVIDER_API_KEY`, `WEATHER_API_KEY`, `GEOCODE_API_KEY`
  * `MEDIA_TTL_SECONDS`, size caps, timeouts
  * rate limits, `LOG_LOCATION_ENABLED`
* Startup validation with clear errors
  **Spec refs:** §15.1 env vars

### T12.2 — Containerize backend and add local docker-compose

**Goal:** Provide reproducible backend runtime.
**Deliverables:**

* `backend/Dockerfile`
* `docker-compose.yml` for local dev
* Healthcheck path wired to `/v1/health`
  **Spec refs:** §7.1 health, §15 Deployment

### T12.3 — Mobile environment configuration

**Goal:** Manage backend base URL + API key in dev builds securely-ish for v1.
**Deliverables:**

* Config approach (e.g., build-time env injection)
* Separate configs for dev/staging
* Ensure no production keys are committed
  **Spec refs:** §12.1 auth, §15.2 release strategy

---

## 13) Acceptance Checklist Automation

### T13.1 — Create a “Build Acceptance Criteria” test checklist runner

**Goal:** Map §16 checklist into an executable/trackable QA checklist (even if partly manual).
**Deliverables:**

* `docs/acceptance.md` with each §16 bullet mapped to:

  * automated test (link), or
  * manual QA steps (clear)
* CI summary output indicating which are automated
  **Spec refs:** §16 Engineering Checklist
