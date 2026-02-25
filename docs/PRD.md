# PRD: CastSense (Mobile-Only AI Fishing Assistant)

---

# 1. Overview

## Product Name

**CastSense** (working name)

## One-Liner

A mobile-only app that captures a photo of a body of water, automatically enriches it with environmental and location context, and uses on-device processing with OpenAI's multimodal AI to visually show the best places to cast and how to fish them.

## Vision

When standing at any shoreline, a user can open the app, point the camera at the water, and instantly receive:

* Where to cast
* What to throw
* How to retrieve
* What species are most likely (or how to target a chosen species)

The app acts like a personal AI fishing guide, processing everything locally on your device with your own OpenAI API key.

## Primary Goal

Deliver scene-aware, actionable cast recommendations in under 10–15 seconds from capture, with complete privacy (no data sent to our servers).

## Non-Goals (v1)

* Guaranteeing fish presence
* Replacing sonar/depth finders
* Building a social network
* Tournaments or competition features
* Crowdsourced public hotspot maps
* Backend server infrastructure
* Video capture and analysis (photo-only)
* Storing user data on external servers

---

# 2. Product Principles

## Mobile-First, Privacy-First

CastSense is a **mobile-only application** with no backend server.

Key principles:

* **All processing happens on-device** or via user's own OpenAI API key
* **No data sent to our servers** - complete user privacy
* **BYO API Key model** - users provide their own OpenAI API key
* Users maintain full control of their data and API costs

## Provider-First AI

CastSense intentionally avoids building a rule-based fishing engine in v1.

Instead:

* Gather maximum structured context on-device
* Perform local enrichment (weather, solar, geocoding)
* Send context + media directly to OpenAI via user's API key
* Enforce strict output schema locally
* Render the results visually

The AI model handles reasoning and tactical decisions, while all data stays under user control.

## Structured Context > Hardcoded Heuristics

We will implement deterministic systems for:

* Context gathering
* Data enrichment
* Output validation
* Overlay rendering

But we will not hardcode fishing behavior rules into the application logic.

---

# 3. Target User

## Primary (v1)

* Personal use
* Comfortable with experimental accuracy
* Wants actionable guidance quickly

## Future

* Beginner anglers
* Travelers fishing unfamiliar water
* Casual weekend anglers

---

# 4. User Modes

## Mode A: General

**Purpose:** Recommend best strategy for likely fish in the area.

Behavior:

* AI infers likely species from region + context
* Outputs 1–3 cast zones optimized for highest success probability
* May rank multiple species

---

## Mode B: Specific

**Purpose:** Optimize strategy for a selected species.

User selects:

* Largemouth bass
* Smallmouth bass
* Trout
## First-Time Setup

1. I download the app
2. I open Settings
3. I enter my OpenAI API key
4. The app validates the key
5. I'm ready to fish

## Analysis Flow

1. I open the app
2. I choose General or Specific mode
3. I snap a photo
4. The app processes the image locally
5. It enriches with weather, location, and solar data
6.Platform toggle (Shore / Kayak / Boat)
* Button: Open Camera
* Settings button (top-right corner)

## Settings Screen

* OpenAI API Key management
  - Input field for API key
  - Validation status indicator
  - Help link to OpenAI API key creation
* App info (version, privacy policy)
* About section

## Capture Screen

* Live camera preview
* Photo capture button
* After capture → automatic analysis

## Processing Screen

Loading indicator with stages:

* Processing image
* Enriching context (location, weather, solar)
---

# 6. UX & Flow

## Home Screen

* Mode selector (General / Specific)
* Capture type (Photo / Video)
* Platform toggle (Shore / Kayak / Boat)
* Button: Open Camera

## Capture Screen

* Live camera preview
* Capture button
* Video record (5–10 seconds recommended)
* After capture → automatic analysis

## Analysis Screen

LoadiMobile-Only Architecture (React Native)

## Mobile App (Cross-Platform)

### Framework

* **React Native**
* Single shared codebase for:

  * Android
  * iOS

### Core Libraries

* Framework: Expo (managed React Native)
* Camera: `expo-camera`
* Location: `expo-location`
* Permissions: Expo permission APIs (built-in)
* Canvas overlays: `@shopify/react-native-skia`
* Networking: `axios` (for OpenAI API + enrichment APIs)
* Storage: `@react-native-async-storage/async-storage` (for API key)
* Device info: `expo-device`, `expo-constants`

### Responsibilities of Mobile App

* **Settings Management**
  - Store/retrieve OpenAI API key securely
  - Validate API key format and connectivity
  - Display usage guidance

* **Image Capture & Processing**
  - Camera capture (photo-only)
  - Image processing and optimization
  - Orientation detection and correction

* **Context Enrichment (On-Device)**
  - Collect GPS + timestamp
  - Fetch weather data from public APIs
  - Calculate solar position (sunrise/sunset)
  - Reverse geocoding for waterbody identification
  - Build canonical context pack

* **AI Integration**
  - Send enriched context + image to OpenAI API
  - Use user's API key for all requests
  - Handle streaming responses
  - Enforce timeout limits

* **Validation & Rendering**
  - Validate AI output against local schemas
  - Attempt repair if output malformed
  - Render overlays using normalized coordinates
  - Display tactics UI
  - Handle retries + loading states

### Overlay Rendering

AI returns normalized coordinates (0–1).

Client:

* Maps normalized coords to screen dimensions
* Draws:

  * Polygon zones
  * Cast arrows
  * Retrieve paths
* Ensures overlays scale correctly across devices

### Data Flow (Mobile-Only)

1. **Capture**: User takes photo
2. **Process**: Image resized/optimized on-device
3. **Enrich**: Parallel API calls for weather, geocoding, solar
4. **Analyze**: Send to OpenAI using user's API key
5. **Validate**: Check output schema locally
6. **Render**: Display overlays on captured image

**No backend server - all orchestration happens on the mobile device.**
# 8. Backend Architecture

## Thin Orchestration Layer

Responsibilities:
8. Inputs

## Required

* Photo (video not supported in v1)
* GPS location
* Timestamp
* Mode (General / Specific)
* OpenAI API key (stored in settingsse

Backend stack options:

* Node.js (Fastify / Express)
* OR Python (FastAPI)

Stateless preferred for v1.

---

# 9. Inputs

## Required

* Photo OR video
* GPS location
* 9. Context Enrichment (On-Device)

All enrichment happens on the mobile device via public APIs:

## Location

* Reverse geocode (via Nominatim or similar free API)
* Identify waterbody name
* Infer water type (lake/river/etc.)

## Weather

* Air temperature
* Wind speed/direction
* Cloud cover
* Precipitation last 24h
* Pressure + trend
* (via Open-Meteo or similar free API)

## Solar

* Sunrise
* Sunset
* Daylight classification
* (calculated locally using SunCalc or similar)

## Hydrology (Optional, best-effort)

* River flow rate
* Gauge height
* (via USGS or similar public API)

## Species Likelihood

* Regional species lookup
* A0-inferred from context
* Daylight classification

## Hydrology (if available)

* River flow rate
* Gauge height

## Species Likelihood

* Regional species lookup
* Stocking datasets (if feasible)
* Fallback: regional defaults

---

# 11. Context Pack (Canonical JSON)

```json
{
  "mode": "specific",
  "target_species": "smallmouth bass",
  "user_context": {
    "platform": "shore",
    "gear_type": "spinning"
  },
  "location": {
    "lat": 44.97,
    "lon": -93.26,
    "waterbody_name": "Mississippi River",
    "water_type": "river"
  },
  "time": {
    "local_time": "18:42",
    "season": "winter",
    "sunrise": "07:11",
    "sunset": "17:38",
    "daylight_phase": "after_sunset"
  },
  "weather": {
    "air_temp_f": 29,
    "wind_speed_mph": 12,
    "wind_direction_deg": 280,
    "cloud_cover_pct": 60,
    "precip_last_24h_in": 0.1,
    "pressure_trend": "falling"
  },
  "species_context": {
    "likely_species": ["smallmouth bass", "walleye"]
  }1. AI System Design

## OpenAI-Based Multimodal Analysis

AI responsibilities (via user's OpenAI API key):

* Interpret scene from photo
* Detect visible fishing structure
* Infer cast zones
* Generate lure + retrieve recommendations
* Provide explanation grounded in scene + context

## Two-Stage Prompting (Client-Side)

The mobile app orchestrates two API calls to OpenAI:

### Stage 1: Perception

* Send: Image + minimal context
* Receive: Structured scene observations
* (Helps reduce hallucinated structure)

### Stage 2: Planning

* Send: Observations + full context pack + mode
* Receive: Final overlay/tactics JSON schema

All API calls use the user's stored OpenAI API key.age 2: Planning
2
Generate zones + tactics using:

* Observations
* Context pack
* Mode

---

# 13. Output Schema

AI must return strict JSON.

```json
{
  "mode": "general",
  "likely_species": [
    {"species": "largemouth bass", "confidence": 0.72}
  ],
  "zones": [
    {
      "zone_id": "A",
      "label": "Primary",
      "confidence": 0.81,
      "target_species": "largemouth bass",
      "polygon": [[0.12,0.55],[0.18,0.52],[0.22,0.60],[0.14,0.63]],
      "cast_arrow": {"start":[0.50,0.85],"end":[0.18,0.57]},
      "retrieve_path": [[0.18,0.57],[0.25,0.63]]
    }
  ],
  "tactics": [
    {
      "zone_id": "A",
      "recommended_rig": "Texas-rigged worm",
      "target_depth": "3-8 ft",
      "retrieve_style": "Slow drag with pauses",
      "why_this_zone_works": [
        "Visible weedline edge",
        "Wind pushes baitfish toward this bank"
      ]
    }
  ],
  "3. Functional Requirements

* Must support Android and iOS from same codebase
* Must securely store OpenAI API key on device
* Must render overlays consistently across device sizes
* Must complete analysis in < 15 seconds
* Must retry once if AI output malformed
* Must handle missing enrichment gracefully
* Must work with photo capture only (no video)
* Must validate API key before allowing analysis
* Must provide clear guidance for obtaining OpenAI API ke

# 14. Functional Requirements

* Must support Android and iOS from same codebase
* M4. Non-Functional Requirements

## Performance

* Photo analysis: < 10 seconds (typical)
* Photo analysis: < 15 seconds (P95)
* Image processing: < 1 second
* Enrichment: < 3 seconds total (parallel calls)
* AI analysis: < 8 seconds (typical)

## Privacy

* **No data sent to our servers**
* All processing local or via user's own API key
* Photos stored temporarily on device, deleted after analysis
* API key stored in device secure storage (Keychain/Keystore)
* Location never shared with our servers
* Complete user data ownership

## 5. Error Handling

### Error States

* **No API Key**: Prompt user to enter key in Settings
* **Invalid API Key**: Show validation error with help link
* **No GPS**: Prompt user to enable location services
* **No Network**: Show offline message, suggest retry
* **AI Timeout**: Automatic retry once, then show error
* **Invalid JSON**: Attempt local repair, fallback to text-only
* **Enrichment Failures**: Continue with partial data
* **Rate Limit (OpenAI)**: Show user-friendly message about their API quota

### Fallback Behavior

* Prompt user to enable location
* Retry AI call once automatically
* S6. State Machine

The mobile app follows this state machine:

```
Idle → ModeSelected → Capturing → Processing → Enriching → Analyzing → Results
                                                                           ↓
                                                         Error → (retry or Idle)
```

**States:**

* **Idle**: Home screen, no active session
* **ModeSelected**: User chose General/Specific mode
* **Capturing**: Camera active, waiting for photo
* **Processing**: Image processing and optimization
* **Enriching**: Fetching weather, location, solar data
* **Analcapture only (no video)
* Settings screen with API key management
* On-device context pack builder
* Weather/solar/location enrichment
* Direct OpenAI API integration (user's key)
* Local schema validation
* Overlay rendering
* General + Specific modes
* Complete privacy (no backend server)

Excluded:

* Backend server infrastructure
* Video capture and analysis
* Live AR mode
* Catch logging
* Offline inference (requires network for enrichment + AI)
* Social features
* Personal model tuning
* Analytics or telemetry

* Retry repair on invalid JSON
* Show graceful error states
 (< 15s)
* API key setup is straightforward
* Users understand data privacy model
* Enrichment succeeds reliably (>95% success rate)
* LocaPrivacy & Trust Benefits

## Why Mobile-Only Matters

* **Your Data Stays Yours**: Photos never leave your device except to OpenAI (via your API key)
* **No Account Required**: No sign-up, no login, no user tracking
* **API Cost Transparency**: You control and see your OpenAI costs directly
* **No Server Dependency**: App works as long as OpenAI API is available
* **Open Architecture**: You can audit exactly where your data goes

## Trust Model

* We don't see your photos
* We don't see your locations
* We don't see your fishing spots
* We don't track your usage
* We don't store anything on external servers

**The app is a tool that runs on YOUR device with YOUR API key.**

# 21. Future Roadmap
2. Summary

CastSense is a **mobile-only** React Native app that:

* Captures photos of fishing water (video support in future)
* Processes images locally on your device
* Enriches context with weather, solar, and location data
* Sends structured context + media directly to OpenAI using **your API key**
* Receives strict JSON output describing cast zones and tactics
* Validates output locally against schemas
* Renders actionable overlays directly on the captured scene
* Supports both General and Specific fishing modes

**Key differentiators:**

* **No backend server** - all orchestration on-device
* **Complete privacy** - your data never touches our servers
* **BYO API Key** - you control costs and data
* **Photo-only v1** - simpler, faster, focused
* **Local validation** - ensures quality output

It prioritizes **privacy, speed, and user control** while leveraging AI-driven reasoning through a transparent, auditable architecture
* Continuous analysis while panning camera
* Alternative AI providers (Anthropic, local models)

## v4

* Waterbody memory (stored locally)
* Personalized lake intelligence
* Smarter species probability modeling
* Local AI models (fully offline)
---

# 17. Safety & Disclaimers

* Fishing outcomes are probabilistic
* Watch for slippery banks
* Respect local regulations
* Private property warning

---

# 18. MVP Scope (v1)

Included:

* React Native app (Android + iOS)
* Photo + video capture
* Context pack builder
* Weather enrichment
* AI provider integration
* Strict output schema
* Overlay rendering
* General + Specific modes

Excluded:

* Live AR mode
* Catch logging
* Offline inference
* Social features
* Personal model tuning

---

# 19. Success Metrics (Personal v1)

* Recommendations feel coherent and usable
* Zones align with visible structure
* Advice changes meaningfully based on conditions
* Latency acceptable in real fishing situations

---

# 20. Future Roadmap

## v2

* Catch feedback loop
* Personal preference learning
* Species dataset improvements

## v3

* Live AR mode
* Continuous analysis while panning camera

## v4

* Waterbody memory
* Personalized lake intelligence
* Smarter species probability modeling

---

# 21. Summary

CastSense is a cross-platform React Native mobile app that:

* Captures photo/video of fishing water
* Enriches the capture with environmental context
* Sends structured context + media to a multimodal AI provider
* Receives strict JSON output describing cast zones and tactics
* Renders actionable overlays directly on the captured scene
* Supports both General and Specific fishing modes

It prioritizes speed, iteration, and AI-driven reasoning while enforcing structure through schema validation and normalized coordinate rendering.
