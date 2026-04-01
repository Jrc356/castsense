# CastSense Contracts

Canonical JSON Schemas for request, response, result, and error envelopes.

## Schemas

- metadata.schema.json
- response.schema.json
- result.schema.json
- error.schema.json

## Type Generation

Run:

make contracts-generate-types

Generated outputs:
- web/src/types/contracts.ts
- backend/src/types/contracts.ts
