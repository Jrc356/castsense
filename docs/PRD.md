# PRD: CastSense (Provider-First AI Fishing Assistant, Cross-Platform)

---

# 1. Overview

## Product Name

**CastSense** (working name)

## One-Liner

A cross-platform mobile app that captures a photo or video of a body of water, automatically pulls environmental and location context, and uses multimodal AI to visually show the best places to cast and how to fish them.

## Vision

When standing at any shoreline, a user can open the app, point the camera at the water, and instantly receive:

* Where to cast
* What to throw
* How to retrieve
* What species are most likely (or how to target a chosen species)

The app acts like a personal AI fishing guide.

## Primary Goal

Deliver scene-aware, actionable cast recommendations in under 10–15 seconds from capture.

## Non-Goals (v1)

* Guaranteeing fish presence
* Replacing sonar/depth finders
* Building a social network
* Tournaments or competition features
* Crowdsourced public hotspot maps

---

# 2. Product Principles

## Provider-First AI

CastSense intentionally avoids building a rule-based fishing engine in v1.

Instead:

* Gather maximum structured context
* Send context + media to a multimodal AI provider
* Enforce strict output schema
* Render the results visually

The AI model handles reasoning and tactical decisions.

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
* Walleye
* etc.

Behavior:

* AI focuses recommendations exclusively on chosen species
* Tactics are species-optimized

---

# 5. Core User Stories

1. I open the app.
2. I choose General or Specific mode.
3. I snap a photo (or record short video).
4. The app analyzes the scene.
5. It overlays cast zones directly on my captured image.
6. I tap a zone to see lure + retrieve instructions.
7. I follow the plan.

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

Loading indicator:

* Identifying location
* Pulling weather
* Analyzing structure
* Generating cast plan

## Results Screen

* Captured image displayed
* Overlaid zones + arrows + retrieve paths
* Bottom sheet with tactics
* Tabs:

  * Plan
  * Conditions
  * Species (General mode)

---

# 7. Cross-Platform Architecture (React Native)

## Mobile Client (Cross-Platform)

### Framework

* **React Native**
* Single shared codebase for:

  * Android
  * iOS

### Recommended Libraries

* Camera: `react-native-vision-camera`
* Location: `react-native-geolocation-service`
* Permissions: `react-native-permissions`
* Video processing: native modules or FFmpeg binding
* Canvas overlays: `react-native-skia` or `react-native-svg`
* Networking: fetch/axios

### Responsibilities of Mobile Client

* Camera capture + preview
* Video trimming (if needed)
* Extract keyframes for video analysis
* Collect GPS + timestamp
* Render overlays using normalized coordinates
* Display tactics UI
* Handle retries + loading states

### Overlay Rendering

AI returns normalized coordinates (0–1).

Client:

* Maps normalized coords to screen dimensions
* Draws:

  * Polygon zones
  * Cast arrows
  * Retrieve paths
* Ensures overlays scale correctly across devices

---

# 8. Backend Architecture

## Thin Orchestration Layer

Responsibilities:

* Accept media uploads
* Build context pack
* Fetch enrichment APIs
* Call multimodal AI provider
* Validate schema
* Retry repair if needed
* Return final JSON response

Backend stack options:

* Node.js (Fastify / Express)
* OR Python (FastAPI)

Stateless preferred for v1.

---

# 9. Inputs

## Required

* Photo OR video
* GPS location
* Timestamp
* Mode (General / Specific)

## Optional

* Species (Specific mode)
* Shore/Kayak/Boat
* Gear constraints

---

# 10. Context Enrichment

## Location

* Reverse geocode
* Identify waterbody name
* Infer water type (lake/river/etc.)

## Weather

* Air temperature
* Wind speed/direction
* Cloud cover
* Precipitation last 24h
* Pressure + trend

## Solar

* Sunrise
* Sunset
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
  }
}
```

---

# 12. AI System Design

## Provider-First Multimodal Analysis

AI responsibilities:

* Interpret scene
* Detect visible fishing structure
* Infer cast zones
* Generate lure + retrieve recommendations
* Provide explanation grounded in scene + context

## Two-Stage Prompting (Recommended)

### Stage 1: Perception

Extract structured scene observations.

### Stage 2: Planning

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
  "plan_summary": [
    "Start at Zone A and work parallel to the weed edge."
  ]
}
```

---

# 14. Functional Requirements

* Must support Android and iOS from same codebase
* Must render overlays consistently across device sizes
* Must complete analysis in < 15 seconds
* Must retry once if AI output malformed
* Must handle missing enrichment gracefully

---

# 15. Non-Functional Requirements

## Performance

* Photo: < 10 seconds
* Video: < 15 seconds

## Privacy

* Media deleted after processing by default
* No public GPS sharing

## Reliability

* Retry repair on invalid JSON
* Show graceful error states

---

# 16. Error Handling

### Failures

* No GPS
* No network
* AI timeout
* Invalid JSON

### Fallback

* Prompt user to enable location
* Retry AI call once
* Show simplified text-only plan if rendering fails

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
