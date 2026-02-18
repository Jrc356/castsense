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

- Node.js >= 20.x
- npm >= 10.x
- For mobile: React Native CLI, Xcode (iOS), Android Studio (Android)

### Backend Development

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

The backend will start on `http://localhost:3000`. Test the health endpoint:

```bash
curl http://localhost:3000/v1/health
```

### Type Generation

Generate TypeScript types from JSON Schemas:

```bash
cd contracts
npm install
npm run generate-types
```

This outputs types to:
- `mobile/src/types/contracts.ts`
- `backend/src/types/contracts.ts`

### Mobile Development

```bash
cd mobile
npm install
npx pod-install  # iOS only

# Run on iOS
npm run ios

# Run on Android
npm run android
```

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
