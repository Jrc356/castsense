# LangChain Integration

CastSense uses LangChain.js for its AI layer, providing structured output parsing, conversation memory, and robust error handling.

## Architecture

### Components

1. **Config** (`config/langchain.ts`)
   - Model factory: `createChatModel(apiKey, modelName)`
   - Default: gpt-4o with 30s timeout, 0.7 temperature

2. **Prompts** (`services/langchain-prompts.ts`)
   - `buildContextPack()`: Transform enrichment → structured context
   - `formatAnalysisPrompt()`: Render ChatPromptTemplate with context
   - Semantic versioning (`PROMPT_VERSION = '1.0.0'`)

3. **Parsers** (`services/langchain-parsers.ts`)
   - Zod schema validation
   - `parseAIResult()`: Async validation with error recovery
   - `parseAIResultSync()`: Synchronous variant
   - Custom geometry validation (polygon bounds, zone-tactics consistency)

4. **Analysis Chain** (`services/langchain-chain.ts`)
   - Main orchestrator: config → prompt → model → parser
   - Error mapping: LangChain errors → mobile error codes
   - 30s timeout handling

5. **Memory** (`services/langchain-memory.ts`)
   - Session-based conversation storage
   - `createSessionId()`: Generate unique session IDs
   - `addToMemory()`: Store analysis results
   - `getConversationHistory()`: Retrieve history for follow-ups

6. **Follow-Up Handler** (`services/langchain-followup.ts`)
   - Handle contextual questions without re-analyzing
   - Uses conversation history
   - Returns text responses

### State Machine Integration

The state machine tracks session IDs for follow-up support:

- `Results` state: Stores `sessionId` when analysis completes
- `FollowUp` state: Tracks active follow-up question
- `canAskFollowUp(state)`: Check if follow-ups are supported
- `getSessionId(state)`: Retrieve current session ID

### Flow Diagram

```
Photo/Video → Image Processing → Enrichment → LangChain Analysis → Results
                                                       ↓
                                              Session Memory
                                                       ↓
                                              Follow-Up Queries
```

## Usage Examples

### Basic Analysis

```typescript
import { analyzeWithLangChain } from './services/langchain-chain';
import { createSessionId } from './services/langchain-memory';

const result = await analyzeWithLangChain({
  modelName: 'gpt-4o',
  imageBase64: 'data:image/jpeg;base64,...',
  imageWidth: 1920,
  imageHeight: 1080,
  enrichment: enrichmentData,
  location: { latitude: 34.05, longitude: -118.25 },
  options: { mode: 'general' },
  apiKey: 'sk-...'
});

if (result.success) {
  const sessionId = createSessionId();
  receiveResults(result.data, sessionId);
}
```

### Follow-Up Query

```typescript
import { handleFollowUpQuestion } from './services/langchain-followup';

const result = await handleFollowUpQuestion(
  sessionId,
  'What lure should I use in Zone Z1?',
  apiKey,
  'gpt-4o'
);

if (result.success) {
  console.log(result.response);
}
```

## Error Codes

| Code | Meaning | Retryable |
|------|---------|-----------|
| `AI_TIMEOUT` | Model exceeded 30s | Yes |
| `AI_RATE_LIMITED` | Rate limit hit | Yes |
| `AI_INVALID_KEY` | Bad API key | No |
| `AI_NETWORK_ERROR` | Network failure | Yes |
| `AI_PARSE_ERROR` | Invalid output | Yes |
| `AI_PROVIDER_ERROR` | OpenAI service error | Yes |

## Testing

- **Unit Tests**: 300+ tests across all components
- **Integration Tests**: 25 end-to-end tests
- **Coverage**: Config, prompts, parsers, chain, memory, follow-ups

Run tests:
```bash
npm test -- langchain
```

## Migration from Old AI Client

The old `ai-client.ts` is deprecated. Use `langchain-chain.ts` instead:

**Before:**
```typescript
import { analyzeImage } from './services/ai-client';
const result = await analyzeImage({ ... });
```

**After:**
```typescript
import { analyzeWithLangChain } from './services/langchain-chain';
const result = await analyzeWithLangChain({ ... });
```

The `analysis-orchestrator.ts` automatically uses LangChain via feature flag (`USE_LANGCHAIN = true`).

## Performance

- Prompt generation: ~5ms
- Parsing & validation: ~10ms
- Total overhead: <20ms (negligible vs 5-15s model latency)

## Future Enhancements

- [ ] Persistent memory (AsyncStorage)
- [ ] Streaming responses for follow-ups
- [ ] Agent tools for enrichment (vs pre-computed)
- [ ] Custom retry strategies
- [ ] Prompt A/B testing framework
