# CastSense Technical Specification (Mobile-Only Architecture)

## 1. Purpose and Scope

This document defines the technical architecture, key technical decisions, system contracts (schemas), non-functional requirements, security/privacy controls, observability, and implementation notes for **CastSense v1**: a **mobile-only** React Native app that generates cast-zone overlays and tactics from a photo plus enriched environmental context using the user's OpenAI API key.

**In-scope (v1)**

* React Native app (iOS + Android) for capture, processing, and overlay rendering
* On-device image processing and optimization
* Photo-only support (no video)
* On-device context enrichment (weather, solar, geocoding)
* Direct OpenAI API integration using user's API key
* General + Specific modes
* Strict, render-ready JSON output (normalized coordinates)
* Local schema validation and repair
* Settings screen for API key management

**Out-of-scope (v1)**

* Backend server infrastructure
* Video capture and analysis
* Live AR mode (continuous camera inference)
* Social features or public hotspot maps
* Offline inference (requires network for enrichment + AI)
* Analytics or telemetry servers

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

* **Framework**: Expo (managed React Native workflow for iOS + Android)
* **Camera**: `expo-camera` (photo capture only)
* **Overlays**: `@shopify/react-native-skia` (high-performance canvas rendering)
* **Networking**: `axios` (HTTP client for API calls)
* **Location**: `expo-location` (precise GPS)
* **Storage**: `@react-native-async-storage/async-storage` (API key storage)
* **Secure Storage**: `expo-secure-store` (encrypted API key storage)
* **Device Info**: `expo-device`, `expo-constants`, `expo-localization`
* **Image Processing**: `expo-image-manipulator` (resize, optimize, orientation)
* **Solar Calculations**: `suncalc` or similar library (local computation)

Rationale:

* Expo provides streamlined development with OTA updates
* All processing happens on-device - no backend complexity
* Secure storage ensures API key protection
* Image processing on-device reduces network payload
* Local solar calculations eliminate API dependency
* No video processing complexity in v1

### 3.2 Architecture Decision: No Backend

**Why mobile-only?**

* **Privacy**: User data never leaves device except to trusted external APIs (OpenAI, weather)
* **Simplicity**: No server infrastructure to maintain, scale, or secure
* **Cost**: No hosting costs; users pay only for their OpenAI usage
* **Transparency**: Users can audit exactly where data goes
* **Control**: Users manage their own API keys and costs

**Trade-offs accepted:**

* Requires device network connectivity
* Client must handle enrichment orchestration
* Limited caching (device-local only)
* User responsible for API key management

### 3.3 Key Constraints

* Normalized coordinate system: all zones/arrows/paths use `[0..1]` coordinates
* Latency target: complete analysis in < 15s (photo), typical conditions
* Single repair attempt if output is malformed, then fallback to text-only plan
* Photo-only (no video support in v1)
* Network required for enrichment and AI analysis
* OpenAI API key required for core functionality

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

## 5. Mobile App Specification

### 5.1 Settings & API Key Management

**Settings Screen**

* Input field for OpenAI API key
* Validation:
  - Format check (starts with `sk-`)
  - Connectivity test (simple API call to verify key works)
  - Visual feedback (✓ valid, ✗ invalid)
* Secure storage using `expo-secure-store`
* Help link to OpenAI API key documentation
* App version and privacy policy links

**API Key Validation**

```typescript
async function validateApiKey(key: string): Promise<boolean> {
  if (!key.startsWith('sk-')) return false;
  try {
    // Test with minimal API call
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
```

### 5.2 Image Capture & Processing

**Photo Capture**

* Use `expo-camera` for capture
* Single tap capture (no video)
* Orientation detection and correction using EXIF
* Preview before processing

**On-Device Processing**

* Resize to max dimension 1920px (long edge) if larger
* Optimize JPEG quality (85%)
* Fix orientation using `expo-image-manipulator`
* Convert HEIC to JPEG if needed (iOS)
* Output format: base64 or file URI for OpenAI API

### 5.3 Context Enrichment (On-Device Orchestration)

**Parallel Enrichment**

Client orchestrates parallel API calls with individual timeouts:

```typescript
const enrichmentResults = await Promise.allSettled([
  fetchWeather(lat, lon),        // 2s timeout
  reverseGeocode(lat, lon),      // 2s timeout
  calculateSolar(lat, lon, timestamp), // synchronous, <100ms
  fetchHydrology(lat, lon)       // 2s timeout, optional
]);
```

**Enrichment Modules**

1. **Weather** (Open-Meteo API - free, no key required)
   - Air temp, wind speed/direction
   - Cloud cover, precipitation
   - Pressure and trend if available
   
2. **Reverse Geocoding** (Nominatim - free, no key required)
   - Waterbody name
   - Admin area, country
   - Water type inference (lake/river/pond)

3. **Solar** (SunCalc library - local computation)
   - Sunrise/sunset times
   - Daylight phase classification
   - Solar position

4. **Hydrology** (USGS API - optional, best-effort)
   - River flow rate
   - Gauge height
   - Only for identified river locations

**Error Handling**

* Each enrichment module returns `{ status: 'ok' | 'failed', data?: any }`
* Failures do not block overall flow
* Partial context pack is acceptable
* Status shown in UI (e.g., "Weather data unavailable")

### 5.4 Coordinate Mapping and Rendering

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

### 5.5 Client State Machine

* `Idle` - Home screen
* `ModeSelected` - User chose General/Specific
* `Capturing` - Camera active
* `Processing` - Image processing on-device
* `Enriching` - Fetching weather/location/solar
* `Analyzing` - Sending to OpenAI, waiting for response
* `Results` - Displaying overlays and tactics
* `Error` - Failure state with retry option

**Transitions:**

* `Idle` → `ModeSelected` (user selects mode)
* `ModeSelected` → `Capturing` (open camera)
* `Capturing` → `Processing` (photo taken)
* `Processing` → `Enriching` (image ready)
* `Enriching` → `Analyzing` (context ready)
* `Analyzing` → `Results` (AI response valid)
* `Analyzing` → `Error` (AI timeout, invalid response, network error)
* `Error` → `Processing` (retry)
* `Error` → `Idle` (cancel)
* `Results` → `ModeSelected` (new analysis)

Error states:

* **No API Key** → redirect to Settings
* **No GPS permission** → prompt + allow manual retry
* **No network** → show retry
* **AI error / timeout** → retry once; show text-only fallback if provided
* **Invalid output** → attempt repair once; fallback to text-only

### 5.6 AI Integration (OpenAI API)

**Two-Stage Orchestration**

Stage 1: Perception
```typescript
const perceptionResponse = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "system",
      content: "Extract structured observations from this fishing scene."
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Analyze this water for fishing structure." },
        { type: "image_url", image_url: { url: imageDataURL } }
      ]
    }
  ],
  response_format: { type: "json_object" }
});
```

Stage 2: Planning
```typescript
const planningResponse = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "system",
      content: "Generate fishing plan with overlay coordinates."
    },
    {
      role: "user",
      content: JSON.stringify({
        observations: perceptionResponse.content,
        context: contextPack,
        mode: "general",
        // ... full context
      })
    }
  ],
  response_format: { type: "json_object" }
});
```

**Timeout Handling**

* Set axios timeout: 12s default
* Retry once on timeout
* Show user-friendly error if both fail

### 5.7 Local Validation

**Schema Validation**

* Use JSON Schema (via `ajv` or similar)
* Validate against `result.schema.json` (local copy)
* Check coordinate bounds `[0, 1]`
* Verify polygon geometry (≥3 points)
* Check referential integrity (zone_id consistency)

**Repair Strategy**

If validation fails:
1. Construct detailed error message
2. Send repair request to OpenAI with errors
3. Validate repaired output
4. If still invalid: fallback to text-only mode

```typescript
if (!validate(aiOutput)) {
  const repaired = await repairOutput(aiOutput, validate.errors);
  if (!validate(repaired)) {
    return { rendering_mode: 'text_only', plan_summary: [...] };
  }
  return repaired;
}
```

---

## 6. Data Contracts

### 6.1 Canonical Context Pack (Mobile-Generated)

The mobile app produces a canonical context pack for AI analysis:

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

## 7. AI Output Schema (Overlay-Ready)

### 7.1 Final Result Schema

```json
{
  "mode": "general|specific",
  "likely_species": [
    { "species": "string", "confidence": 0.0 }
  ],
  "analysis_frame": {
    "type": "photo",
    "width_px": 1920,
    "height_px": 1080
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

### 7.2 Constraints

* `zones.length`: 1–3 (recommended)
* `polygon`: must contain ≥ 3 points; each point `[x,y]` within `[0,1]`
* `cast_arrow.start/end`: within `[0,1]`
* `retrieve_path`: optional; if present, each point within `[0,1]`
* `confidence` fields: `0..1`
* `tactics[].zone_id` must match an entry in `zones[].zone_id`

### 7.3 Text-only Fallback Result

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

## 8. Error Handling

### 8.1 Error Categories (Mobile UI)

Mobile app categorizes errors for appropriate UI handling:

| Code | Meaning | Retryable | User Action |
|------|---------|-----------|-------------|
| `NO_API_KEY` | Missing OpenAI API key | No | Go to Settings |
| `INVALID_API_KEY` | API key validation failed | No | Check key in Settings |
| `NO_NETWORK` | No internet connection | Yes | Retry when online |
| `NO_GPS` | Location unavailable | No | Enable location services |
| `AI_TIMEOUT` | OpenAI request timeout | Yes | Retry analysis |
| `AI_ERROR` | OpenAI API error | Varies | Show error message |
| `INVALID_OUTPUT` | Schema validation failed | Yes | Auto-retry with repair |
| `ENRICHMENT_FAILED` | All enrichment failed | Yes | Proceed with minimal context |

### 8.2 Error State UI

* Display appropriate error component (see `mobile/src/components/errors/`)
* Show actionable buttons (Retry, Go to Settings, Cancel)
* Provide helpful context (e.g., "Check your internet connection")
* Log errors locally for debugging (no external transmission)

---

### 9.1 Local Timing Metrics

The mobile app tracks performance locally (not sent to external servers unless user opts in):

* Image processing time
* Enrichment time (per provider + total)
* AI perception time
* AI planning time
* Validation time
* Total analysis time

Displayed in developer mode or exported for debugging.

### 9.2 Error Logging

* Errors logged locally on device
* Stack traces captured for debugging
* No automatic external transmission
* Optional export for bug reports (user-initiated)

###  9.3 Success Metrics

* Enrichment success rates (weather, geocoding, solar, hydrology)
* AI output validation rate (valid vs invalid vs repaired)
* User retry frequency
* State transitions and timing

---

## 10. AI Prompting Requirements

### 10.1 Output Must Be JSON Only

* No prose surrounding JSON
* Must conform to result schema
* Use OpenAI's `response_format: { type: "json_object" }`

### 10.2 Mode Behavior

* **General**: include `likely_species` array with confidences; zones may target top species
* **Specific**: focus tactics on `target_species`; `likely_species` may still include but must not override targeting

### 10.3 Safety / Disclaimers

* `conditions_summary` or `plan_summary` should include safety notes when relevant (e.g., slippery banks, high wind, ice conditions)
* Remind users to check local fishing regulations
* Do not guarantee fish presence

---

## 11. Mobile App Configuration

### 1.1 Required Configuration

**User-Provided:**
* OpenAI API key (stored in `expo-secure-store`)

**App Constants:**
* Default enrichment timeouts (2s per service)
* Default AI timeout (12s)
* Max image dimension (1920px)
* JPEG quality (85%)
* Max zones displayed (3)

**Optional Configuration (future):**
* Preferred AI model
* Enable/disable specific enrichment services
* Debug mode toggle

### 11.2 No Environment Variables

Unlike backend applications, no environment variables needed. All configuration either:
* Provided by user (API key)
* Hardcoded as app constants
* Stored in app preferences (future)

---

## 12. Testing Strategy

### 12.1 Unit Tests (Mobile)

* Coordinate mapping logic
* Polygon hit testing
* Schema validation
* Error categorization
* State machine transitions

See: `mobile/src/__tests__/`

### 12.2 Integration Tests

* Camera capture flow (mocked)
* Enrichment orchestration (mocked APIs)
* OpenAI API integration (mocked responses)
* End-to-end analysis flow

### 12.3 Manual QA

* Real device testing (iOS & Android)
* Various camera orientations
* Network failure scenarios
* GPS enabled/disabled
* Invalid API key handling
* Different aspect ratios

---

## 13. Engineering Checklist (Mobile-Only)

**Core Functionality**

* ✅ Photo capture (camera permissions, orientation handling)
* ✅ Settings screen with API key management
* ✅ API key validation (format + connectivity test)
* ✅ Secure storage of API key
* ✅ Image processing (resize, optimize, orientation correction)
* ✅ Context enrichment (weather, geocoding, solar)
* ✅ OpenAI API integration (two-stage prompting)
* ✅ Local schema validation
* ✅ Overlay rendering (normalized coordinates)
* ✅ Error handling with appropriate UI
* ✅ State machine implementation

**Quality Assurance**

* ✅ Unit tests for coordinate mapping
* ✅ Unit tests for polygon hit testing
* ✅ Schema validation tests
* ✅ Error handling tests
* ✅ State machine tests
* ✅ Manual testing on iOS
* ✅ Manual testing on Android
* ✅ Cross-device aspect ratio testing
* ✅ Network failure scenario testing
* ✅ GPS permission testing

**Performance**

* ✅ Analysis completes < 15s (P95)
* ✅ Image processing < 1s
* ✅ Enrichment < 3s total
* ✅ UI remains responsive during processing

**Privacy & Security**

* ✅ API key encrypted at rest
* ✅ No data sent to CastSense servers
* ✅ TLS for all external API calls
* ✅ Temporary media cleanup
* ✅ No telemetry without opt-in

---

## 14. Appendix: JSON Schema Snippets

### 14.1 Zone Object (JSON Schema fragment)

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

### 14.2 Tactics Object (JSON Schema fragment)

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

---

## 15. Summary

CastSense v1 is a **mobile-only React Native application** that:

* Captures photos on-device (no video in v1)
* Processes images locally (resize, optimize, orientation)
* Enriches context via public APIs (weather, geocoding, solar)
* Analyzes using OpenAI API (user's own API key)
* Validates output locally against JSON schemas
* Renders overlays directly on captured images
* Maintains complete user privacy (no CastSense backend)

**Key architectural decisions:**

* **No backend server** - eliminates infrastructure, maximizes privacy
* **BYO API Key** - users control costs and data
* **Photo-only** - simplifies v1, faster iteration
* **Local validation** - ensures quality without server dependency
* **Direct external APIs** - uses free/user-provided services (Open-Meteo, Nominatim, OpenAI)

**Privacy guarantee:** Photos and location data never sent to CastSense servers. Only sent to:
- OpenAI (via user's API key)
- Public weather APIs (Open-Meteo)
- Public geocoding APIs (Nominatim)

This architecture prioritizes user privacy, development velocity, and operational simplicity while delivering AI-powered fishing recommendations.
