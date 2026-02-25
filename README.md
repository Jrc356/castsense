# CastSense

A mobile-only AI fishing assistant that provides scene-aware cast recommendations using your own OpenAI API key.

## Overview

CastSense captures a photo of a body of water, gathers environmental context (GPS, weather, solar position), and uses AI vision to visually show the best places to cast and how to fish them. All processing happens locally on your device using the OpenAI Vision API.

**Key Features:**
- 📸 Photo capture with on-device analysis
- 🔑 BYO (Bring Your Own) OpenAI API key — your key, your privacy
- 🌍 Real-time enrichment (geocoding, weather, solar calculations)
- 🎯 Visual cast zones overlaid on your photo
- 🎣 Tactical fishing recommendations (retrieve speed, cast angle, lure type)
- 📱 Works offline for capture, online for AI analysis

## Project Structure

```
castsense/
├── mobile/          # React Native + Expo app (iOS + Android)
├── contracts/       # JSON Schemas and type generation
└── docs/            # Documentation (PRD, spec, acceptance criteria)
```

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 10
- Expo CLI (installed automatically with `npm install`)
- For iOS: macOS with Xcode 14+
- For Android: Android Studio with SDK 33+
- **OpenAI API key** (get one at [platform.openai.com](https://platform.openai.com))

### Setup

1. **Clone the repository:**

```bash
git clone <repo-url>
cd castsense
```

2. **Install mobile dependencies:**

```bash
cd mobile
npm install
```

3. **Start the development server:**

```bash
npm start
```

This launches Expo Dev Tools. From there, you can:
- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan the QR code with Expo Go (iOS) or Camera app (Android) to run on a physical device

4. **Configure your OpenAI API key:**

Once the app launches:
- Navigate to **Settings** screen
- Enter your OpenAI API key
- The key is stored securely on-device using Expo SecureStore

### Running on Devices

**iOS Simulator:**
```bash
npm run ios
```

**Android Emulator:**
```bash
npm run android
```

**Physical Device:**
- Install **Expo Go** from App Store (iOS) or Play Store (Android)
- Run `npm start` and scan the QR code

## Development Workflow

### Type Generation

Generate TypeScript types from JSON Schemas:

```bash
cd contracts
npm install
npm run generate-types
```

This outputs validated types to `mobile/src/types/contracts.ts`.

### Testing

Run the mobile test suite:

```bash
cd mobile
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # With coverage report
```

Tests use Jest with `ts-jest` preset. See [mobile/jest.config.js](mobile/jest.config.js) for configuration.

### Code Quality

```bash
cd mobile
npm run lint               # ESLint check
npm run typecheck          # TypeScript validation
```

## Tech Stack

**Mobile App:**
- React Native + Expo SDK 52
- TypeScript (strict mode)
- State management: Context API + useReducer (state machine pattern)
- Navigation: React Navigation 7

**AI & Processing:**
- OpenAI SDK (gpt-4o-mini vision)
- Image processing: expo-image-manipulator
- Schema validation: AJV (JSON Schema Draft 2020-12)

**Enrichment APIs:**
- Geocoding: Nominatim (OpenStreetMap)
- Weather: Open-Meteo
- Solar calculations: suncalc library

**Native Integrations:**
- Camera: expo-camera
- Location: expo-location
- Permissions: Expo APIs
- Secure storage: expo-secure-store

## Architecture

### Mobile-Only Design

CastSense runs entirely on your device with no backend server:

1. **Capture** → Photo taken with expo-camera
2. **Process** → Image resized and oriented on-device
3. **Enrich** → Parallel API calls for geocoding, weather, solar data
4. **Analyze** → OpenAI Vision API (using your BYO API key)
5. **Validate** → Strict schema validation with AJV
6. **Render** → Cast zones overlaid on original photo

### State Machine

The app uses a strict state machine for predictable UI flow (see [mobile/src/state/machine.ts](mobile/src/state/machine.ts)):

```
Idle → Capturing → Processing → Enriching → Analyzing → Results
                                                  ↓
                                               Error → (retry)
```

All state transitions are validated and type-safe using discriminated union actions.

### Privacy & Security

- **API keys** stored locally using expo-secure-store (encrypted)
- **No analytics** or tracking
- **No backend** — your photos never leave your device except for direct OpenAI API calls
- **No account** required

## Configuration

All configuration happens in the Settings screen:

- **OpenAI API Key** (required) — your BYO key for AI analysis
- **Model selection** — choose between gpt-4o and gpt-4o-mini
- **Photo quality** — balance between quality and upload size

Future settings:
- Weather API provider selection
- Cache duration for enrichment data
- Debug mode for viewing raw AI responses

## Error Handling

The app categorizes errors for user-friendly messaging (see [mobile/src/services/ai-client.ts](mobile/src/services/ai-client.ts)):

| Error Type | User Message | Retryable |
|------------|--------------|-----------|
| `NO_NETWORK` | No internet connection | Yes |
| `NO_GPS` | Location unavailable | No |
| `INVALID_MEDIA` | Photo processing failed | No |
| `AI_TIMEOUT` | Analysis took too long | Yes |
| `AUTH_FAILED` | Invalid API key | No |
| `NETWORK_ERROR` | Request failed | Yes |
| `PARSE_ERROR` | Invalid response | Yes |

## Documentation

- [Product Requirements (PRD)](docs/PRD.md)
- [Technical Specification](docs/spec.md)
- [Acceptance Criteria](docs/acceptance.md)
- [Mobile README](mobile/README.md)

## Contributing

1. Create a feature branch
2. Make changes with tests
3. Run `npm test` and `npm run typecheck`
4. Submit PR with clear description

## License

UNLICENSED - Private project
