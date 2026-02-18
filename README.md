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
- Node.js >= 20.x (for local contracts type generation)
- npm >= 10.x

### Using Make (Recommended)

The easiest way to get started is with the included Makefile:

```bash
make help                          # See all available commands
make up                            # Start all services in Docker
make logs                          # View service logs
make backend-test                  # Run backend tests in Docker
make contracts-generate-types      # Generate TypeScript types from schemas
```

The backend API will be available at `http://localhost:3000`:

```bash
curl http://localhost:3000/v1/health
```

To stop the services:

```bash
make down
```

### Backend Development (Docker)

Start the development environment:

```bash
make up
```

Then open a shell in the backend container:

```bash
make backend-shell
```

Or view live logs:

```bash
make backend-logs
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
