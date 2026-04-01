# CastSense - Copilot Instructions

## Purpose

Provide practical guidance for working in this repository after migration from mobile to web.

## Quick Start

- make install
- make start
- make lint
- make typecheck
- make test

## Architecture

- web/: primary frontend (React + TypeScript + Vite)
- backend/: single Node service that serves health and production web assets
- web/src/types/contracts.ts: locally maintained app domain types

## Testing

Web tests run with Vitest from web/.

Primary command:

make test

## Guidance for Assistants

- Prefer small, targeted TypeScript changes.
- Keep state flow grounded in web/src/state/machine.ts and web/src/state/AppContext.tsx.
- For rendering overlays, reuse coordinate mapping and polygon hit-testing utilities in web/src/utils.
- For current parity mode, API keys are stored in browser localStorage via web/src/services/api-key-storage.ts. Treat this as development-only and plan backend proxy hardening before production.
