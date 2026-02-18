# CastSense

A cross-platform mobile app that uses multimodal AI to provide scene-aware fishing cast recommendations.

## Overview

CastSense captures a photo or video of a body of water, gathers environmental context (GPS, weather, time), and uses AI to visually show the best places to cast and how to fish them.

## Project Structure

```
castsense/
├── mobile/          # React Native app (iOS + Android)
├── backend/         # Fastify API service (Node.js + TypeScript)
├── contracts/       # Shared JSON Schemas and type generation
└── docs/            # Documentation (PRD, spec, work breakdown)
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js >= 18 (for mobile development and type generation)
- npm >= 10
- For mobile: Xcode (iOS) or Android Studio (Android)

### Backend Development

The easiest way to get started is with the included Makefile:

```bash
make help                          # See all available commands
make up                            # Start backend in Docker
make logs                          # View service logs
make backend-test                  # Run backend tests in Docker
make contracts-generate-types      # Generate TypeScript types from schemas
```

The backend API will be available at `http://localhost:3000`:

```bash
curl http://localhost:3000/v1/health
```

### Mobile Development (Expo)

The mobile app uses Expo for local development:

```bash
cd mobile
npm install                        # Install dependencies
npm start                          # Start Expo dev server

# In another terminal:
npm run ios -- --device           # Run on iOS device/simulator
npm run android -- --device       # Run on Android device/emulator
```

The app will auto-detect your computer's LAN IP and connect to the backend running in Docker.

See [mobile/README.md](mobile/README.md) for detailed setup instructions.

To stop the backend:

```bash
make down
```

### Type Generation

Generate TypeScript types from JSON Schemas:

```bash
make contracts-generate-types
```

This outputs types to:
- `mobile/src/types/contracts.ts`
- `backend/src/types/contracts.ts`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/health` | Health check |
| POST | `/v1/analyze` | Analyze photo/video and return cast zones |

## Configuration

See `backend/.env.example` for all available environment variables:

- `AI_PROVIDER_API_KEY` - AI provider API key (required)
- `WEATHER_API_KEY` - Weather API key (required)
- `GEOCODE_API_KEY` - Geocoding API key (required)
- `MAX_PHOTO_BYTES` - Max photo upload size (default: 8MB)
- `MAX_VIDEO_BYTES` - Max video upload size (default: 25MB)

## Documentation

- [Product Requirements (PRD)](docs/PRD.md)
- [Technical Specification](docs/spec.md)
- [Work Breakdown](docs/work.md)

## Architecture

### Provider-First AI

CastSense uses a provider-first approach:
1. Gather maximum structured context
2. Send context + media to a multimodal AI provider
3. Enforce strict output schema validation
4. Render results as overlay zones

### Data Flow

1. Client captures photo/video + collects GPS/timestamp
2. Backend receives media + metadata
3. Backend enriches context (weather, geocode, solar)
4. Backend invokes AI with media + context pack
5. Backend validates AI output against schema
6. Client renders overlay zones on captured image

## License

UNLICENSED - Private project
