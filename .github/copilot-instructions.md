<!-- Copilot Instructions for the CastSense workspace -->
# CastSense — Copilot Instructions

Purpose
-------
Provide quick, actionable guidance for AI assistants and contributors to run, test, and reason about this repo.

Quick Start (local)
-------------------
- **Backend**: install and run development server

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

- **Mobile**: install and start Metro / run on device

```bash
cd mobile
npm install
npx pod-install   # macOS iOS only
npm start
npm run ios|android
```

- **Contracts / Types**: generate shared TypeScript types

```bash
cd contracts
npm install
npm run generate-types
```

Tests & CI
----------
- Backend tests: `cd backend && npm test` (Jest configured; CI runs `npm test -- --coverage --ci`). See [backend/jest.config.js](backend/jest.config.js#L1).
- Mobile tests: `cd mobile && npm test` (Jest + ts-jest). See [mobile/jest.config.js](mobile/jest.config.js#L1).
- CI pipeline and expectations are in [.github/workflows/ci.yml](.github/workflows/ci.yml#L1).

Docker & Local Compose
----------------------
- The repo provides `docker-compose.yml` and a development override `docker-compose.dev.yml`. Use:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Conventions & Notes
-------------------
- Language: TypeScript across backend and mobile. Use `tsc --noEmit` for type checks.
- Testing: Jest with `ts-jest` preset. Backend tests live under `backend/src/__tests__` and mobile tests under `mobile/src/__tests__`.
- Contracts: canonical JSON Schemas in the `contracts/` directory. Types are generated into both `mobile` and `backend`.
- AI flow: backend collects context, enriches weather/geocode/solar, then invokes provider; outputs are strictly validated against `result.schema.json`.

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
