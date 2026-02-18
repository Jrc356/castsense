<!-- Copilot Instructions for the CastSense workspace -->
# CastSense — Copilot Instructions

Purpose
-------
Provide quick, actionable guidance for AI assistants and contributors to run, test, and reason about this repo.

Quick Start (Docker with Make)
------------------------------
All development is Docker-based. Use the Makefile for common tasks:

```bash
make help                    # Show all available commands
make up                      # Start all services in Docker
make backend-test            # Run backend tests
make contracts-generate-types # Generate types from schemas
make down                    # Stop all services
```

### Backend Development
```bash
make up               # Start backend in Docker
make backend-shell    # Open shell in backend container
make backend-logs     # View backend logs
```

### Mobile Development
```bash
cd mobile
npm install           # Install dependencies
npm start             # Start Expo dev server
npm run ios           # Run on iOS (macOS only)
npm run android       # Run on Android
```

Mobile app uses Expo and auto-detects the backend URL (localhost for simulator, LAN IP for physical devices).

### Type Generation
```bash
make contracts-generate-types
```

This outputs types to both `mobile/src/types/contracts.ts` and `backend/src/types/contracts.ts`.

Tests & CI
----------
- Backend tests: `make backend-test` (runs in Docker via Jest). Full coverage test: `make backend-test -- --coverage --ci`. See [backend/jest.config.js](backend/jest.config.js#L1).
- Mobile tests: can be run with `cd mobile && npm test` (Jest + ts-jest). See [mobile/jest.config.js](mobile/jest.config.js#L1).
- CI pipeline and expectations are in [.github/workflows/ci.yml](.github/workflows/ci.yml#L1).

Docker & Local Compose
----------------------
All development is Docker-based through the Makefile. Use:

```bash
make up            # Start all services (docker-compose.yml + docker-compose.dev.yml)
make down          # Stop all services
make logs          # View service logs
```

The Docker Compose files are located at [docker-compose.yml](docker-compose.yml#L1) and [docker-compose.dev.yml](docker-compose.dev.yml#L1).

Conventions & Notes
-------------------
- Language: TypeScript across backend and mobile. Use `tsc --noEmit` for type checks.
- Testing: Jest with `ts-jest` preset. Backend tests live under `backend/src/__tests__` and mobile tests under `mobile/src/__tests__`.
- Contracts: canonical JSON Schemas in the `contracts/` directory. Types are generated into both `mobile` and `backend`.
- AI flow: backend collects context, enriches weather/geocode/solar, then invokes provider; outputs are strictly validated against `result.schema.json`.
- Mobile: Uses Expo for development. Camera (expo-camera), location (expo-location), permissions (Expo APIs).

Key Files & Entry Points
------------------------
- Backend entry: [backend/src/index.ts](backend/src/index.ts#L1)
- API routes: [backend/src/routes](backend/src/routes)
- Contracts and schema generation: [contracts/README.md](contracts/README.md#L1)
- Docker compose: [docker-compose.yml](docker-compose.yml#L1)

How the assistant should help
----------------------------
- Prefer small, targeted changes that follow the repo style (TypeScript, minimal diff).
- Run backend tests locally before proposing CI-related changes.
- When suggesting code changes, include test updates and commands to run them.

Example Prompts
---------------
- "Run the backend unit tests and report failing tests and traces."
- "Add a small helper to validate AI outputs against `result.schema.json` and tests." 
- "Create an endpoint to return Docker health status and add tests."

Suggested Agent Customizations
-----------------------------
- `create-integration-agent` — automates running backend tests, lint, and typecheck, then opens a PR with fixes.
- `generate-contract-types` — runs `contracts/scripts/generate-types.ts` and commits type updates to both `mobile` and `backend`.

Where to ask for help
---------------------
- Open an issue or draft PR with reproducible steps. Include failing test output and relevant logs.

Maintainers: see `README.md` for architecture and config details.
