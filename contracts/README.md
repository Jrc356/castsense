# CastSense Contracts

This directory contains the canonical JSON Schema definitions for the CastSense API.

## Schema Files

| File | Description | Spec Reference |
|------|-------------|----------------|
| `metadata.schema.json` | Client → Backend request metadata | §7.2 |
| `response.schema.json` | Response envelope wrapper | §7.4 |
| `result.schema.json` | AI output / overlay-ready result | §9 |
| `error.schema.json` | Standard error response | §10.1 |

## Versioning

Schemas follow semantic versioning principles:

- **Major version**: Breaking changes to required fields or structure
- **Minor version**: New optional fields or capabilities
- **Patch version**: Documentation or validation rule clarifications

The current version is embedded in each schema's `$id` field.

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-02-17 | Initial schema definitions |

## Compatibility Rules

### Adding Fields
- New **optional** fields can be added without version bump
- New **required** fields require major version increment

### Removing Fields
- Removing fields always requires major version increment
- Deprecated fields should be marked before removal

### Consumers
- Clients MUST ignore unknown fields
- Clients MUST NOT send unknown fields
- Servers SHOULD validate strictly in development, warn in production

## Type Generation

TypeScript types are generated from these schemas for both mobile and backend:

```bash
npm install
npm run generate-types
```

This generates:
- `../mobile/src/types/contracts.ts`
- `../backend/src/types/contracts.ts`

## Validation

Schemas use JSON Schema draft-07. Recommended validators:
- **Node.js**: `ajv` with `ajv-formats`
- **React Native**: `ajv` (same)

## Usage Example

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import metadataSchema from '@castsense/contracts/metadata.schema.json';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(metadataSchema);

const isValid = validate(requestMetadata);
if (!isValid) {
  console.error(validate.errors);
}
```
