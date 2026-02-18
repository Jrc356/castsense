# CastSense Technical Specification (Engineering Handoff)

## 1. Purpose and Scope

This document defines the technical architecture, key technical decisions, system contracts (schemas + APIs), non-functional requirements, security/privacy controls, observability, and implementation notes for **CastSense v1**: a cross-platform (React Native) provider-first multimodal fishing assistant that generates cast-zone overlays and tactics from a photo or short video plus enriched environmental context.

**In-scope (v1)**

* React Native app (iOS + Android) for capture, upload, and overlay rendering
* Backend orchestration service for enrichment + AI calls + validation/repair
* Photo + video support (5–10s)
* General + Specific modes
* Strict, render-ready JSON output (normalized coordinates)
* Best-effort enrichment (weather, reverse geocode, solar; optional hydrology)

**Out-of-scope (v1)**

* Live AR mode (continuous camera inference)
* Social features or public hotspot maps
* Guarantees of fish presence
* Offline inference

---

## 2. Architectural Approach

### 2.1 High-Level Design

**Provider-first orchestration**: The system avoids hardcoded fishing rules. It maximizes context gathering and uses a multimodal AI provider to reason, while enforcing deterministic output via schema validation.

**Components**

1. **Mobile Client (React Native)**

   * Capture photo/video
   * Collect device + session context (GPS, time, mode, platform)
   * Upload to backend
   * Render overlay zones/arrows/paths from normalized coordinates
   * Display tactics and conditions

2. **Backend Orchestration Service (stateless)**

   * Accept media + metadata
   * Perform context enrichment (parallel API calls)
   * Run AI analysis (two-stage recommended; one-stage acceptable initially)
   * Validate output schema; optionally repair once
   * Return final JSON response
   * Ensure media deletion policy

3. **External Services**

   * Weather API
   * Reverse geocoding / place lookup
   * Solar times calculation (local compute or API)
   * Optional hydrology (river flow) providers
   * AI provider (multimodal with structured output support)

### 2.2 Data Flow

**Photo**

1. Client captures photo → optional downscale → POST `/v1/analyze`
2. Backend stores media transiently (memory or temporary object store)
3. Backend enriches context (fan-out in parallel)
4. Backend invokes AI (perception → planning) with media + context pack
5. Backend validates output JSON; repairs once if needed
6. Backend returns overlay-ready JSON → client renders results

**Video**

1. Client captures 5–10s video → optional transcode/cap → POST `/v1/analyze`
2. Backend extracts 2–4 representative keyframes (or creates a contact sheet)
3. AI operates on keyframes; response includes `selected_frame_index` for overlay alignment
4. Client renders overlays on the returned “analysis frame” (still image) or on the original captured poster frame (as defined by contract)

---

## 3. Technical Decisions

### 3.1 Mobile Technology

* **Framework**: React Native (single codebase for iOS + Android)
* **Camera**: `react-native-vision-camera`
* **Overlays**: `@shopify/react-native-skia` (preferred) or `react-native-svg` (fallback)
* **Networking**: `fetch` or `axios`
* **Location**: platform geolocation library; request precise GPS when available
* **Video processing**: v1 prefers backend keyframe extraction; optional client-side downscale/transcode where needed

Rationale:

* High-performance capture, consistent rendering, minimal client complexity in v1 (video handled server-side)

### 3.2 Backend Technology

* **Service**: Stateless HTTP API (recommended: FastAPI or Node Fastify)
* **Concurrency**: async fan-out for enrichment calls + AI invocation
* **Temporary Media Storage**:

  * Preferred: object storage with TTL lifecycle (S3/GCS) OR ephemeral disk for single-instance dev
  * Media deletion after processing by default; TTL as safety net
* **Validation**: JSON Schema + additional geometric validations
* **AI**:

  * Use structured outputs / schema-constrained generation where supported
  * Two-stage prompting (Perception → Planning) recommended for quality and debuggability

### 3.3 Key Constraints

* Normalized coordinate system: all zones/arrows/paths use `[0..1]` coordinates relative to an explicit reference image size
* Latency target: complete analysis in < 10s (photo) and < 15s (video), typical conditions
* Single repair attempt if output is malformed, then fallback to text-only plan

---

## 4. Non-Functional Requirements

### 4.1 Performance SLAs

* **Photo end-to-end**: P50 < 8s, P95 < 10s
* **Video end-to-end**: P50 < 12s, P95 < 15s
* **Backend AI timeout**: configurable; default 12s (photo), 18s (video) with hard cap

### 4.2 Reliability

* Backend must tolerate partial enrichment failure; proceed with best-effort context pack
* If AI output invalid:

  * Attempt one “repair” call
  * If still invalid: return text-only response that the client can display

### 4.3 Privacy and Data Retention

* Default: delete media immediately after processing completes (success or fail)
* Retain only:

  * request metadata needed for debugging (sanitized)
  * performance metrics
  * optionally coarse location (reduced precision) if analytics enabled
* Provide a configuration flag to disable all location logging

### 4.4 Security

* API key (v1) or OAuth (future)
* Rate limits per API key
* TLS required for all traffic
* Input size caps and content-type enforcement
* Strict CORS policy for any web endpoints (if applicable)

---

## 5. Client Specification

### 5.1 Capture

**Photo**

* Capture with max dimension cap (recommended long edge 1280–1920px) before upload
* Format: JPEG preferred (HEIC allowed if backend supports)

**Video**

* Duration: 5–10 seconds
* Resolution cap: 720p recommended
* Bitrate cap recommended; enforce maximum upload size (see §7.3)

### 5.2 Coordinate Mapping and Rendering

**Coordinate contract**

* AI returns normalized coordinates relative to the **analysis image frame**:

  * `(0,0)` = top-left
  * `(1,1)` = bottom-right
* Client must map normalized points to on-screen coordinates considering:

  * image displayed size (contain vs cover)
  * aspect ratio differences
  * letterboxing offsets

**Rendering requirements**

* Draw:

  * polygon zones (filled + stroked)
  * cast arrow (start/end + arrowhead)
  * retrieve path polyline
* Zone interaction:

  * Hit testing polygon → select zone
  * Bottom sheet updates tactics based on zone

### 5.3 Client State Machine

* `Idle`
* `ModeSelected`
* `Capturing`
* `Uploading`
* `Analyzing`
* `Results`
* `Error`

Error states:

* No GPS permission → prompt + allow manual retry
* No network → show retry
* Server error / timeout → retry once; show text-only fallback if provided

---

## 6. Backend Specification

### 6.1 Service Responsibilities

* Accept media + metadata payload
* Generate canonical context pack (merge client inputs + enrichment)
* Extract keyframes for video
* Invoke AI provider with strict schema requirements
* Validate and optionally repair output
* Return final JSON suitable for immediate rendering
* Enforce media deletion policy

### 6.2 Enrichment Strategy

**Parallel fan-out** with time budgets per provider (soft timeouts). Each enrichment module returns either data or an error object; overall request continues.

Recommended enrichment modules (v1):

* Reverse geocode: waterbody name/place hint
* Weather: wind, temp, cloud cover, precipitation, pressure/trend (if available)
* Solar: sunrise/sunset, daylight phase (compute locally)
  Optional (best-effort):
* Hydrology: gauge height/flow rate if near river/known gauge

### 6.3 Two-Stage AI Orchestration (Recommended)

**Stage 1: Perception**

* Inputs: image(s), minimal context
* Outputs: structured observations about visible structure/features and constraints

**Stage 2: Planning**

* Inputs: observations + full context pack + mode/target species
* Outputs: final overlay/tactics JSON schema

Benefits:

* Reduced hallucinated structure
* Debuggable intermediate artifacts
* Easier prompt iteration

### 6.4 Validation and Repair

**Validation layers**

1. JSON Schema validation (required fields, types)
2. Numeric bounds checks (all coords must be in `[0,1]`)
3. Geometry checks:

   * polygon has ≥ 3 points
   * optional: non-self-intersection best-effort
4. Referential integrity:

   * each `tactics[].zone_id` exists in `zones`
5. Confidence sanity:

   * `0..1` for confidence fields
6. Output length constraints:

   * limit zones to 1–3 in v1 unless configured otherwise

**Repair policy**

* One repair attempt:

  * Provide exact validation errors to AI
  * Request minimal edits to satisfy schema
* If still invalid:

  * Return `rendering_mode = "text_only"` with `plan_summary` and `tactics` sans geometry

---

## 7. API Specification

### 7.1 Endpoint Summary

* `POST /v1/analyze` — Upload media + metadata; receive analyzed plan (overlay JSON)
* `GET /v1/health` — Health check

### 7.2 `POST /v1/analyze` Request

**Content-Type**: `multipart/form-data`

**Form fields**

* `media`: file (required)
* `metadata`: JSON string (required)

**`metadata` schema (Client → Backend)**

```json
{
  "client": {
    "platform": "ios|android",
    "app_version": "string",
    "device_model": "string",
    "locale": "string",
    "timezone": "string"
  },
  "request": {
    "mode": "general|specific",
    "target_species": "string|null",
    "platform_context": "shore|kayak|boat",
    "gear_type": "spinning|baitcasting|fly|unknown",
    "capture_type": "photo|video",
    "capture_timestamp_utc": "2026-02-17T22:14:05Z"
  },
  "location": {
    "lat": 0.0,
    "lon": 0.0,
    "accuracy_m": 15,
    "altitude_m": 250,
    "heading_deg": 123,
    "speed_mps": 0.0
  },
  "user_constraints": {
    "lures_available": ["string"],
    "line_test_lb": 10,
    "notes": "string"
  }
}
```

Notes:

* `location.*` fields are optional except `lat/lon` (required when permissions granted)
* Backend must handle missing location by returning actionable error prompting client to request location

### 7.3 Request Limits

* Max photo size: 8 MB (configurable)
* Max video size: 25 MB (configurable)
* Max processing time: 20s hard timeout (configurable)
* Enrichment provider soft timeout: 2s each (configurable)

### 7.4 `POST /v1/analyze` Response

**Content-Type**: `application/json`

**Response envelope**

```json
{
  "request_id": "string",
  "status": "ok|degraded|error",
  "rendering_mode": "overlay|text_only",
  "timings_ms": {
    "upload": 0,
    "enrichment": 0,
    "ai_perception": 0,
    "ai_planning": 0,
    "validation": 0,
    "total": 0
  },
  "enrichment_status": {
    "reverse_geocode": "ok|failed|skipped",
    "weather": "ok|failed|skipped",
    "solar": "ok|failed|skipped",
    "hydrology": "ok|failed|skipped"
  },
  "context_pack": { },
  "result": { }
}
```

* `status="degraded"` means partial enrichment or fallback was used
* `rendering_mode="text_only"` indicates geometry absent or invalid; client shows textual plan

---

## 8. Canonical Context Pack (Backend-Owned)

The backend produces a canonical context pack passed to AI and returned for UI transparency.

```json
{
  "mode": "general|specific",
  "target_species": "string|null",
  "user_context": {
    "platform": "shore|kayak|boat",
    "gear_type": "spinning|baitcasting|fly|unknown",
    "constraints": {
      "lures_available": ["string"],
      "line_test_lb": 10,
      "notes": "string"
    }
  },
  "location": {
    "lat": 44.97,
    "lon": -93.26,
    "accuracy_m": 15,
    "waterbody_name": "string|null",
    "water_type": "lake|river|pond|ocean|unknown",
    "admin_area": "string|null",
    "country": "string|null"
  },
  "time": {
    "timestamp_utc": "2026-02-17T22:14:05Z",
    "local_time": "18:42",
    "season": "winter|spring|summer|fall",
    "sunrise_local": "07:11",
    "sunset_local": "17:38",
    "daylight_phase": "pre_dawn|sunrise|day|golden_hour|sunset|after_sunset|night"
  },
  "weather": {
    "air_temp_f": 29,
    "wind_speed_mph": 12,
    "wind_direction_deg": 280,
    "cloud_cover_pct": 60,
    "precip_last_24h_in": 0.1,
    "pressure_inhg": 29.85,
    "pressure_trend": "rising|steady|falling|unknown"
  },
  "hydrology": {
    "flow_cfs": 0,
    "gauge_height_ft": 0,
    "source": "string|null",
    "observed_at_utc": "string|null"
  },
  "species_context": {
    "likely_species": [
      { "species": "string", "confidence": 0.0 }
    ],
    "source": "defaults|dataset|ai_inferred"
  }
}
```

---

## 9. AI Output Schema (Overlay-Ready)

### 9.1 Final Result (`result`) Schema

```json
{
  "mode": "general|specific",
  "likely_species": [
    { "species": "string", "confidence": 0.0 }
  ],
  "analysis_frame": {
    "type": "photo|video_frame",
    "width_px": 1920,
    "height_px": 1080,
    "selected_frame_index": 0,
    "frame_timestamp_ms": 0
  },
  "zones": [
    {
      "zone_id": "A",
      "label": "Primary|Secondary|Tertiary|string",
      "confidence": 0.0,
      "target_species": "string",
      "polygon": [[0.12,0.55],[0.18,0.52],[0.22,0.60],[0.14,0.63]],
      "cast_arrow": { "start": [0.50,0.85], "end": [0.18,0.57] },
      "retrieve_path": [[0.18,0.57],[0.25,0.63]],
      "style": {
        "priority": 1,
        "hint": "cover|structure|current|depth_edge|shade|inflow|unknown"
      }
    }
  ],
  "tactics": [
    {
      "zone_id": "A",
      "recommended_rig": "string",
      "alternate_rigs": ["string"],
      "target_depth": "string",
      "retrieve_style": "string",
      "cadence": "string",
      "cast_count_suggestion": "string",
      "why_this_zone_works": ["string"],
      "steps": ["string"]
    }
  ],
  "conditions_summary": [
    "string"
  ],
  "plan_summary": [
    "string"
  ],
  "explainability": {
    "scene_observations": ["string"],
    "assumptions": ["string"]
  }
}
```

### 9.2 Constraints

* `zones.length`: 1–3 (configurable)
* `polygon`: must contain ≥ 3 points; each point `[x,y]` within `[0,1]`
* `cast_arrow.start/end`: within `[0,1]`
* `retrieve_path`: optional; if present, each point within `[0,1]`
* `confidence` fields: `0..1`
* `tactics[].zone_id` must match an entry in `zones[].zone_id`

### 9.3 Text-only Fallback Result

If overlays cannot be produced reliably:

```json
{
  "mode": "general|specific",
  "likely_species": [
    { "species": "string", "confidence": 0.0 }
  ],
  "zones": [],
  "tactics": [
    {
      "zone_id": "N/A",
      "recommended_rig": "string",
      "target_depth": "string",
      "retrieve_style": "string",
      "why_this_zone_works": ["string"],
      "steps": ["string"]
    }
  ],
  "plan_summary": ["string"]
}
```

---

## 10. Error Handling Contracts

### 10.1 Standard Error Response

```json
{
  "request_id": "string",
  "status": "error",
  "error": {
    "code": "NO_GPS|NO_NETWORK|INVALID_MEDIA|AI_TIMEOUT|ENRICHMENT_FAILED|UNKNOWN",
    "message": "string",
    "retryable": true,
    "details": { }
  }
}
```

### 10.2 Retry Guidance

* Client retries once automatically for:

  * `AI_TIMEOUT` (retryable)
  * transient `ENRICHMENT_FAILED` (retryable)
* Client does not auto-retry for:

  * `NO_GPS`, `INVALID_MEDIA`
* Server-side repair occurs independently of client retry

---

## 11. Observability and Logging

### 11.1 Metrics (minimum)

* Request count by status (`ok|degraded|error`)
* Latency: P50/P95/P99 total and per stage (`enrichment`, `ai_perception`, `ai_planning`, `validation`)
* Enrichment success rates per provider
* AI invalid output rate + repair success rate
* Average payload sizes (photo/video), average keyframes extracted
* Error codes distribution

### 11.2 Structured Logs (sanitized)

Log one record per request:

* `request_id`
* timestamps + timings
* app version + platform
* mode + capture_type
* enrichment provider statuses
* AI model identifier and response size (no raw media)
* validation failures (types, not raw content)
* location handling:

  * default: do not log raw lat/lon
  * if enabled: log coarse lat/lon (rounded) only

### 11.3 Tracing

Add trace spans for:

* upload parse
* enrichment fan-out calls
* keyframe extraction
* AI calls
* validation/repair

---

## 12. Security and Privacy Controls

### 12.1 Authentication

* v1: `Authorization: Bearer <API_KEY>`
* Keys are environment-configured; rotate periodically

### 12.2 Rate Limiting

* Per API key:

  * Requests/minute cap
  * Concurrent request cap
* Reject with 429 + retry-after

### 12.3 Media Handling

* Accept only approved MIME types:

  * Photos: `image/jpeg`, `image/heic` (optional), `image/png` (optional)
  * Video: `video/mp4`, `video/quicktime` (optional)
* Virus/malware scanning optional for v1; recommended if opening to external users
* Storage:

  * Write media to ephemeral path or object store with strict TTL
  * Delete on completion (success/error) best-effort; TTL cleanup as backstop

---

## 13. Video Processing Specification (Backend)

### 13.1 Keyframe Extraction

* Extract N frames (default 3):

  * at 20%, 50%, 80% of duration
* Save frames as JPEG at controlled size (e.g., 1280px long edge)
* Provide `analysis_frame.selected_frame_index` and `frame_timestamp_ms` in output

### 13.2 AI Input Strategy

* Provide frames as:

  * multiple images with ordering, OR
  * a stitched contact sheet (single image)
* Planning must refer overlays to the chosen `analysis_frame`

---

## 14. AI Prompting Requirements (Contractual)

### 14.1 Output Must Be JSON Only

* No prose surrounding JSON
* Must conform to schema and constraints

### 14.2 Mode Behavior

* **General**: include `likely_species` array with confidences; zones may target top species
* **Specific**: focus tactics on `target_species`; `likely_species` may still include but must not override targeting

### 14.3 Safety / Disclaimers

* `conditions_summary` or `plan_summary` should include safety notes when relevant (e.g., slippery banks, high wind)
* Do not provide guidance that violates local fishing regulations; optionally remind user to check rules

---

## 15. Deployment and Environment

### 15.1 Configuration (Environment Variables)

* `AI_PROVIDER_API_KEY`
* `WEATHER_API_KEY`
* `GEOCODE_API_KEY`
* `OBJECT_STORE_BUCKET` (optional)
* `MEDIA_TTL_SECONDS` (default 3600)
* `MAX_PHOTO_BYTES`, `MAX_VIDEO_BYTES`
* `ENRICHMENT_TIMEOUT_MS`
* `AI_TIMEOUT_MS_PHOTO`, `AI_TIMEOUT_MS_VIDEO`
* `RATE_LIMIT_RPM`, `RATE_LIMIT_CONCURRENCY`
* `LOG_LOCATION_ENABLED` (default false)

### 15.2 Release Strategy

* Phase 1: photo-only, one-stage AI
* Phase 2: add video keyframes
* Phase 3: enable two-stage prompting and repair metrics
* Phase 4: optional hydrology/waterbody improvements

---

## 16. Engineering Checklist (Build Acceptance Criteria)

**Client**

* Capture photo and video (5–10s)
* Upload request conforms to metadata schema
* Overlay rendering correct across aspect ratios (contain/cover tested)
* Tap zone selects correct tactics
* Error UX for GPS/network/server errors
* Handles `text_only` responses

**Backend**

* `/v1/analyze` accepts and validates inputs + size limits
* Enrichment runs in parallel with timeouts; produces canonical context pack
* Video keyframe extraction reliable and bounded in time
* AI invocation returns schema-constrained JSON
* Validation + single repair attempt implemented
* Media deletion policy enforced
* Observability: metrics + structured logs + trace spans
* Rate limits + authentication enforced

---

## 17. Appendix: JSON Schema Snippets (Authoritative Contracts)

### 17.1 Zone Object (JSON Schema fragment)

```json
{
  "type": "object",
  "required": ["zone_id", "label", "confidence", "target_species", "polygon", "cast_arrow"],
  "properties": {
    "zone_id": { "type": "string", "minLength": 1, "maxLength": 8 },
    "label": { "type": "string" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "target_species": { "type": "string" },
    "polygon": {
      "type": "array",
      "minItems": 3,
      "items": {
        "type": "array",
        "minItems": 2,
        "maxItems": 2,
        "items": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    },
    "cast_arrow": {
      "type": "object",
      "required": ["start", "end"],
      "properties": {
        "start": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "end": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    },
    "retrieve_path": {
      "type": "array",
      "items": {
        "type": "array",
        "minItems": 2,
        "maxItems": 2,
        "items": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    }
  }
}
```

### 17.2 Tactics Object (JSON Schema fragment)

```json
{
  "type": "object",
  "required": ["zone_id", "recommended_rig", "target_depth", "retrieve_style", "why_this_zone_works"],
  "properties": {
    "zone_id": { "type": "string" },
    "recommended_rig": { "type": "string" },
    "alternate_rigs": { "type": "array", "items": { "type": "string" } },
    "target_depth": { "type": "string" },
    "retrieve_style": { "type": "string" },
    "cadence": { "type": "string" },
    "cast_count_suggestion": { "type": "string" },
    "why_this_zone_works": { "type": "array", "minItems": 1, "items": { "type": "string" } },
    "steps": { "type": "array", "items": { "type": "string" } }
  }
}
```
