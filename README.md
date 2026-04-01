# CastSense

A responsive web AI fishing assistant that provides scene-aware cast recommendations using your own OpenAI API key.

## Project Structure

- web/: React + TypeScript + Vite frontend client
- backend/: Node + TypeScript service that serves health and production web assets
- docs/: product, acceptance, and implementation notes

## Quick Start

### Local Development (No Docker)

1. Install dependencies:

   make install

2. Start web development server:

   make start

   Opens [http://localhost:5173](http://localhost:5173)

3. Run quality checks:

   make lint
   make typecheck
   make test

4. Optional single-service smoke run (serves built web from backend):

   make start-single

   Opens [http://localhost:3000](http://localhost:3000)

### With Docker Compose

1. Build and start services:

   docker-compose up --build

   - App: [http://localhost:3000](http://localhost:3000)

2. Stop services:

   docker-compose down

## Architecture Notes

- Local development keeps Vite as the default workflow for fast HMR (`make start`).
- Deployment/runtime is a single service: backend serves static assets from the web build output.
- App domain types are maintained locally in `web/src/types/contracts.ts`.

## API Key Setup

1. Get an OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Open the CastSense app and go to Settings
3. Paste your API key in the input field
4. Settings are saved to browser localStorage

### API Key Model

Current migration parity mode keeps BYO OpenAI keys in browser localStorage.

This is acceptable for local development and migration parity only. Move key handling to a backend proxy before production.
