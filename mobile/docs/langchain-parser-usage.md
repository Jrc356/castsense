# LangChain Structured Output Parser

This module provides LangChain-based validation for AI responses using Zod schemas, replacing the AJV-based validation while maintaining backward compatibility.

## Key Features

- **Zod Schema Validation**: Manually converted `result.schema.json` to comprehensive Zod schema
- **LangChain Integration**: Uses `StructuredOutputParser` for robust parsing
- **Backward Compatible**: Returns same `ValidationResult` interface as original `validation.ts`
- **Custom Geometry Validation**: Preserves domain-specific validation (bounds, zone consistency)
- **JSON Extraction**: Handles markdown code blocks, prose-wrapped JSON
- **TypeScript Types**: Exports `CastSenseResult` type inferred from Zod schema

## Usage

### Basic Parsing (Async)

```typescript
import { parseAIResult, CastSenseResult } from '../services/langchain-parsers';

// Parse AI response
const result = await parseAIResult(aiResponseString);

if (!result.valid) {
  console.error('Validation failed:', result.errors);
  return;
}

// Use validated data (fully typed)
const data = result.parsed as CastSenseResult;
console.log('Zones:', data.zones.length);
console.log('Mode:', data.mode);
```

### Synchronous Parsing

```typescript
import { parseAIResultSync } from '../services/langchain-parsers';

// For synchronous contexts (drop-in replacement for old validateAIResult)
const result = parseAIResultSync(aiResponseString);

if (result.valid) {
  const data = result.parsed as CastSenseResult;
  // Use data
}
```

### Using Format Instructions in Prompts

```typescript
import { getFormatInstructions } from '../services/langchain-parsers';

// Get format instructions for AI prompt
const instructions = getFormatInstructions();

const prompt = `
Analyze this fishing spot and provide cast zones.

${instructions}
`;

// Send prompt to AI model
```

### Handling Validation Errors

```typescript
const result = await parseAIResult(response);

if (!result.valid) {
  result.errors.forEach(error => {
    switch (error.type) {
      case 'parse':
        console.error('Failed to parse JSON:', error.message);
        break;
      case 'schema':
        console.error('Schema violation:', error.message, error.path);
        break;
      case 'geometry':
        console.error('Geometry error:', error.message, error.details);
        break;
      case 'integrity':
        console.error('Data integrity error:', error.message);
        break;
    }
  });
}
```

## Schema Conversion Details

The JSON Schema was **manually converted** to Zod for accuracy:

### Key Conversions

| JSON Schema | Zod Equivalent | Notes |
|-------------|----------------|-------|
| `type: "string"` | `z.string()` | |
| `enum: ["a", "b"]` | `z.enum(['a', 'b'])` | |
| `minimum: 0, maximum: 1` | `z.number().min(0).max(1)` | |
| `minLength: 1, maxLength: 64` | `z.string().min(1).max(64)` | |
| `minItems: 3` | `z.array(...).min(3)` | |
| `required: [...]` | `.strict()` on object | Enforces no extra properties |
| `additionalProperties: false` | `.strict()` | Rejects unknown keys |
| Array of `[x, y]` | `z.tuple([z.number(), z.number()])` | Fixed-length array |

### Normalized Coordinates

- Polygon points: `[[x, y], ...]` where `0 <= x, y <= 1`
- Cast arrow: `{ start: [x, y], end: [x, y] }`
- Retrieve path: `[[x, y], ...]`

All coordinates are **normalized** (0-1 range), not pixel values.

## Custom Validation

### Geometry Validation

Beyond schema compliance, the parser validates:

1. **Normalized Bounds**: All coordinates must be in [0, 1] range
2. **Zone-Tactics Consistency**: Each tactic must reference an existing zone
3. **Polygon Constraints**: Minimum 3 points per polygon

### Example Geometry Error

```typescript
const result = await parseAIResult(response);

const geometryErrors = result.errors.filter(e => e.type === 'geometry');
// [
//   {
//     type: 'geometry',
//     message: 'Zone 0 polygon point 2 out of normalized bounds [0,1]',
//     details: { point: [1.5, 0.5], bounds: [0, 1] }
//   }
// ]
```

## Performance

- **Single parse**: < 100ms
- **Batch (10 parses)**: < 500ms
- **Memory**: Shared parser instance (singleton pattern)

## Migration from AJV

### Before (validation.ts)

```typescript
import { validateAIResult } from '../services/validation';

const result = validateAIResult(aiResponse);
```

### After (langchain-parsers.ts)

```typescript
import { parseAIResultSync } from '../services/langchain-parsers';

const result = parseAIResultSync(aiResponse);
```

**Same interface**: `ValidationResult { valid, errors, parsed }`

### Async Alternative

```typescript
import { parseAIResult } from '../services/langchain-parsers';

const result = await parseAIResult(aiResponse);
```

## Type Safety

The Zod schema provides full TypeScript type inference:

```typescript
import { CastSenseResult } from '../services/langchain-parsers';

function processResult(data: CastSenseResult) {
  // All fields are properly typed
  const mode: 'general' | 'specific' = data.mode;
  const zones: Array<{
    zone_id: string;
    polygon: Array<[number, number]>;
    // ... fully typed
  }> = data.zones;
}
```

## Testing

45 comprehensive tests covering:

- ✅ Schema validation (required fields, types, constraints)
- ✅ JSON extraction (pure JSON, markdown, prose)
- ✅ Custom geometry validation (bounds, integrity)
- ✅ Edge cases (minimal/maximal data, video frames)
- ✅ Performance benchmarks

Run tests:

```bash
npm test -- langchain-parsers.test.ts
```

## Error Types

| Type | Description | Retryable |
|------|-------------|-----------|
| `parse` | Failed to extract/parse JSON | No |
| `schema` | Schema validation failed (missing fields, wrong types) | No |
| `geometry` | Coordinates out of bounds | No |
| `integrity` | Referential integrity error (e.g., zone_id mismatch) | No |

## Next Steps

This parser is **Task 5** in the LangChain migration. Next:

- **Task 6**: Update `ai-client.ts` to use new parser
- **Task 7**: Migrate prompt templates to use `getFormatInstructions()`
- **Task 8**: Integration testing with real AI responses
