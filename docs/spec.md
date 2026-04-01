# CastSense Technical Spec (Web)

## Goal

Provide a web-first system that generates cast-zone overlays and tactical fishing guidance from a user image and enriched context.

## Frontend

- Framework: React + TypeScript + Vite
- Routing: react-router-dom
- State: Context + reducer state machine in web/src/state
- Rendering: HTML image + Canvas overlay in web/src/components/overlays

## Services

- Analysis orchestration: web/src/services/analysis-orchestrator.ts
- Image processing: web/src/services/image-processor.ts
- Enrichment: web/src/services/enrichment.ts
- LangChain integration: web/src/services/langchain-*.ts
- Metadata and permissions: browser API-based service replacements

## Contracts

Canonical schemas in contracts/. Generated types output to:
- web/src/types/contracts.ts
- backend/src/types/contracts.ts

## Non-Functional

- Responsive layouts for phone and desktop
- Lint/type/test gates enabled in web package scripts
- Canvas overlay hit testing based on normalized coordinates
