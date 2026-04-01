# CastSense

A responsive web AI fishing assistant that provides scene-aware cast recommendations using your own OpenAI API key.

## Project Structure

- web/: React + TypeScript + Vite web client
- backend/: backend workspace (currently minimal scaffold)
- contracts/: shared JSON Schemas and generated TypeScript contracts
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

### With Docker Compose

1. Build and start services:

   docker-compose up --build

   - Backend: [http://localhost:3000](http://localhost:3000)
   - Web: [http://localhost:5173](http://localhost:5173)

2. Stop services:

   docker-compose down

## Contracts

Generate shared contract types:

make contracts-generate-types

This writes types to:
- web/src/types/contracts.ts
- backend/src/types/contracts.ts

## API Key Setup

1. Get an OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Open the CastSense app and go to Settings
3. Paste your API key in the input field
4. Settings are saved to browser localStorage

### API Key Model

Current migration parity mode keeps BYO OpenAI keys in browser localStorage.

This is acceptable for local development and migration parity only. Move key handling to a backend proxy before production.
