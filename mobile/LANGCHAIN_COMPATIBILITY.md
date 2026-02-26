# LangChain.js React Native Compatibility Notes

## Installed Packages

Successfully installed on **February 26, 2026**:
- `@langchain/core@^1.1.28`
- `@langchain/openai@^1.2.10`
- `langchain@^1.2.27`

Installation required `--legacy-peer-deps` flag due to pre-existing `react-test-renderer` peer dependency conflict (unrelated to LangChain).

### Known Dependency Issues

⚠️ **Deprecated Transitive Dependency**: `@langchain/langgraph-sdk@2.0.0`
- **Source**: Pulled in by `langchain@1.2.27`
- **Warning**: "This version is not intended for use. Please use 1.x versions"
- **Impact**: No runtime issues observed; this appears to be a version marker/placeholder
- **Action**: Monitor for updates to `langchain` package that resolve this. The main `langchain` package maintainers should address this in a future release.
- **Status**: Known issue as of February 26, 2026. Automated tests pass without errors.

## Node.js Environment Testing

✅ All packages import successfully in Node.js environment
✅ `PromptTemplate` from `@langchain/core` instantiates successfully
✅ `ChatOpenAI` from `@langchain/openai` instantiates successfully
✅ Node.js built-ins (crypto, stream, buffer, events) available in Node.js

## React Native Compatibility

### Known Potential Issues

LangChain.js is built for Node.js and may require polyfills in React Native:

1. **`crypto.getRandomValues()`** - Used by OpenAI SDK for request IDs
   - React Native doesn't have native crypto API
   - May work if `openai` package already handles this

2. **`TextEncoder/TextDecoder`** - Used for text encoding
   - Not available in older React Native versions
   - Expo/modern RN may include these

3. **`URL` API** - Used for parsing endpoints
   - Should be available in React Native 0.81+

4. **`ReadableStream`** - Used for streaming responses
   - May not be available if using streaming features

### Recommended Polyfills (If Needed)

If runtime errors occur, consider installing:

```bash
npm install react-native-get-random-values react-native-url-polyfill text-encoding-polyfill
```

And add to `App.tsx` (before any LangChain imports):

```typescript
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'text-encoding-polyfill';
```

### Testing Strategy

1. **Automated Test Suite**: `src/__tests__/langchain-compatibility.test.ts`
   - Tests import of `@langchain/core` and `@langchain/openai`
   - Checks for required global APIs (TextEncoder, TextDecoder, URL, crypto.getRandomValues)
   - Runs as part of `npm test`

2. **Next Steps** (Task 2):
   - Actually import LangChain in the mobile app
   - Run on simulator/device to detect runtime issues
   - Install polyfills only if errors occur
   - Update this document with findings

## Notes

- The existing `openai` package (v4.28.0) works without explicit polyfills
- This suggests React Native 0.81.5 + Expo 54 may have sufficient built-ins
- **Polyfills should only be added if runtime errors occur** - avoid preemptive installation

## References

- Test scripts created: `test-langchain-imports.js`, `test-langchain-instantiation.js`
- Automated test suite: `src/__tests__/langchain-compatibility.test.ts`
- Metro config already includes workaround for package exports

## Status

✅ **Task 1 Complete**: Dependencies installed and verified in Node.js environment
⏸️ **React Native testing**: Deferred to Task 2 (actual integration)
