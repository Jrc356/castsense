<!-- Copilot Frontend Instructions for CastSense Mobile -->
# CastSense Mobile Frontend — Copilot Instructions

**Scope:** React Native + Expo mobile app development  
**Reference:** See [.github/copilot-instructions.md](.github/copilot-instructions.md) for full architecture overview.

## Quick Start

```bash
cd mobile
npm install
npm start                    # Expo dev server
npm run ios                  # iOS (macOS only)
npm run android              # Android
npm test                     # Run tests
npm run typecheck            # Type check
npm run lint                 # ESLint
```

## Architecture

### Navigation (Native Stack)

Use [mobile/src/navigation/AppNavigator.tsx](mobile/src/navigation/AppNavigator.tsx#L1) with React Navigation native-stack:

```
HomeScreen (mode selection)
├── CaptureScreen (camera)
├── ResultsScreen (overlay + tactics)
└── ErrorScreen (error handling)
```

Navigation params use **discriminated unions** for type safety:

```typescript
type RootStackParamList = {
  Home: undefined
  Capture: { mode: 'general' | 'specific' }
  Results: { response: CastSenseResponseEnvelope }
  Error: { error: AppError; retryable: boolean }
}
```

### State Management (Context + useReducer)

**Ground truth:** [mobile/src/state/machine.ts](mobile/src/state/machine.ts#L1)

State flow:
```
Idle
  → selectMode(mode) → ModeSelected
    → startCapture() → Capturing
      → receiveResults(data) → Results
      ↑                    ↓
      ← retry() ← handleError(error) ← Error
```

**Always use the `useApp()` hook** for dispatching actions:

```typescript
const { state, selectMode, startCapture, receiveResults, handleError, retry } = useApp()

// Never mutate state directly
selectMode('general')  // ✅ correct
state = newState       // ❌ wrong
```

### Screen Patterns

**HomeScreen** — Simple mode selector
```typescript
const { selectMode } = useApp()
// Dispatch: selectMode('general') or selectMode('specific')
```

**CaptureScreen** — Full-screen camera
```typescript
// Trigger upload on capture
const { startCapture, receiveResults, handleError } = useApp()

// On capture complete:
// 1. startCapture() → state.Uploading
// 2. Call api.analyzeMedia(media, metadata, onProgress)
// 3. receiveResults(response) or handleError(error)
```

**ResultsScreen** — Display overlay + tactics
```typescript
const { state } = useApp()
const { response } = useCaptureRoute()  // Type-safe params
// Display: response.overlay_zones, response.tactics
```

**ErrorScreen** — Error with retry logic
```typescript
const { state, retry, selectMode } = useApp()

// Show retry button only if: state.error.retryable && canRetry(state)
// Retry: retry()
// Abandon: selectMode(undefined) → back to Home
```

## API Integration

### Axios Client

[mobile/src/services/api.ts](mobile/src/services/api.ts#L1) provides:

```typescript
analyzeMedia(
  media: MediaFile,
  metadata: CastSenseRequestMetadata,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; data?: CastSenseResponseEnvelope; error?: AppError }>
```

### Error Handling

Mobile API client **categorizes errors** by code:

| Code | Cause | Retryable | UI Action |
|------|-------|-----------|-----------|
| `NO_NETWORK` | No internet | ✅ Yes | Show "Check internet" |
| `NO_GPS` | Location permission denied | ❌ No | Show "Enable location" |
| `INVALID_MEDIA` | Corrupt/bad video | ❌ No | Show "Try again with different media" |
| `AI_TIMEOUT` | Model timed out | ✅ Yes | Show "Taking longer..." |
| `AUTH_FAILED` | API key invalid | ❌ No | Show "Configuration error" |
| `NETWORK_ERROR` | Server/timeout | ✅ Yes | Show "Server error" |
| `PARSE_ERROR` | Bad JSON response | ✅ Yes | Show "Server error" |

**Always check `error.retryable` before offering retry:**

```typescript
const { handleError } = useApp()

try {
  const result = await api.analyzeMedia(media, metadata)
  if (result.success) {
    receiveResults(result.data!)
  } else {
    handleError(result.error!)
  }
} catch (err) {
  const appError = { code: 'NETWORK_ERROR', message: '...', retryable: true }
  handleError(appError)
}
```

## React Native Performance Rules

**Reference:** [.agents/skills/vercel-react-native-skills/AGENTS.md](.agents/skills/vercel-react-native-skills/AGENTS.md)

Apply these rules for every screen:

### 1. **Render Safety (CRITICAL)**
- ❌ Never: `{count && <Text>Items</Text>}` (crashes if count=0)
- ✅ Use: `{count > 0 ? <Text>Items</Text> : null}`
- ✅ Use: `{!!count && <Text>Items</Text>}` (explicit coercion)

- ❌ Never: `<View>text</View>` (crashes)
- ✅ Use: `<View><Text>text</Text></View>`

### 2. **List Performance (HIGH)**
- Use `LegendList` or `FlashList`, never ScrollView with mapped children
- Pass primitives to list items, derive objects inside
- Hoist callbacks outside renderItem
- Keep list items lightweight (no queries, minimal hooks)
- Use `getItemType()` for heterogeneous lists

Example:
```typescript
<LegendList
  data={items}
  renderItem={({ item }) => (
    // ✅ Pass primitives
    <ResultItem id={item.id} name={item.name} />
  )}
  keyExtractor={(item) => item.id}
  estimatedItemSize={80}
/>

const ResultItem = memo(function ResultItem({ id, name }) {
  // ✅ Lightweight, no queries
  const { isFavorited } = useFavoritesStore((s) => s.items.has(id))
  return <Pressable><Text>{name}</Text></Pressable>
})
```

### 3. **Navigation (HIGH)**
- ✅ Always: Native stack (`@react-navigation/native-stack`)
- ✅ Always: Native tabs (react-native-bottom-tabs or expo-router native-tabs)
- ❌ Avoid: JS-based stacks or tabs

### 4. **Animation (HIGH)**
- Animate `transform` and `opacity`, never `width`/`height`/`top`/`left`
- Use `useDerivedValue` for deriving values from shared values
- Use `GestureDetector` for press animations (UI thread)

Example:
```typescript
const pressed = useSharedValue(0)

const tap = Gesture.Tap()
  .onBegin(() => pressed.set(withTiming(1)))
  .onFinalize(() => pressed.set(withTiming(0)))

const style = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.95]) }],
}))
```

### 5. **State (MEDIUM)**
- Derive values instead of storing redundant state
- Use fallback state for user intent: `state ?? defaultValue`
- Use dispatch updaters for state depending on current value

### 6. **Scroll (HIGH)**
- ❌ Never: `useState` for scroll position (causes jank)
- ✅ Use: Reanimated `useAnimatedScrollHandler` if needed for animation
- ✅ Use: `useRef` if only needed for non-reactive tracking

### 7. **Styling (MEDIUM)**
- Always use `borderCurve: 'continuous'` with `borderRadius`
- Use `gap` for spacing between elements
- Use `boxShadow` CSS syntax instead of shadow objects
- Use weight/color for emphasis, not font size variation
- Use `contentInset` for dynamic ScrollView spacing

Example:
```typescript
<View style={{ gap: 12, padding: 16, borderRadius: 12, borderCurve: 'continuous' }}>
  <Text style={{ fontWeight: '600' }}>Title</Text>
  <Text style={{ color: '#666' }}>Subtitle</Text>
</View>
```

## Configuration

### API URL Auto-Detection

[mobile/src/config/api.ts](mobile/src/config/api.ts#L1) auto-detects backend:

1. `EXPO_PUBLIC_API_URL` env var (explicit override)
2. Simulator → `http://localhost:3000`
3. Physical device → auto-detect LAN IP
4. Fallback → `http://localhost:3000`

**To override:** Set `EXPO_PUBLIC_API_URL` in `.env.local` or `app.config.js`

### Permissions

Verify in [mobile/app.config.js](mobile/app.config.js#L1):
- `ios.infoPlist.NSCameraUsageDescription`
- `ios.infoPlist.NSLocationWhenInUseUsageDescription`
- `android.permissions` includes `CAMERA`, `ACCESS_FINE_LOCATION`

## Testing

### Unit Tests

```bash
npm test                     # Jest + ts-jest
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report
```

**Test structure:** `src/__tests__/**/*.test.ts`

Example:
```typescript
describe('ResultsScreen', () => {
  it('should render overlay zones', () => {
    const response = { overlay_zones: [...] }
    const { getByTestId } = render(<ResultsScreen response={response} />)
    expect(getByTestId('overlay')).toBeTruthy()
  })
})
```

### Type Checking

```bash
npm run typecheck            # tsc --noEmit
```

Always run before committing.

## Common Patterns

### Handling State Transitions

```typescript
function CaptureScreen() {
  const { state, startCapture, receiveResults, handleError } = useApp()

  const handleCapture = async (media) => {
    if (!canStartCapture(state)) {
      console.warn('Cannot capture in state:', state.type)
      return
    }

    startCapture()

    try {
      const result = await api.analyzeMedia(media, metadata)
      if (result.success) {
        receiveResults(result.data!)
      } else {
        handleError(result.error!)
      }
    } catch (err) {
      handleError({ code: 'NETWORK_ERROR', retryable: true })
    }
  }

  return <CameraView onCapture={handleCapture} />
}
```

### Memoized List Items

```typescript
const TacticItem = memo(function TacticItem({ 
  id, 
  title, 
  description 
}: Props) {
  // ✅ Only re-renders if id/title/description change
  return (
    <View>
      <Text>{title}</Text>
      <Text>{description}</Text>
    </View>
  )
}, (prev, next) => {
  // Custom comparison: return true to skip re-render
  return prev.id === next.id && prev.title === next.title
})
```

### Safe Navigation Params

```typescript
function ResultsScreen() {
  const { response } = useCaptureRoute() // Type-safe, throws if wrong screen
  
  // response is guaranteed to be CastSenseResponseEnvelope
  return <OverlayView zones={response.overlay_zones} />
}
```

## Debugging

### State Machine Stuck?
Check [mobile/src/state/machine.ts](mobile/src/state/machine.ts#L1) for valid transitions:
```typescript
// Valid transitions from Uploading: Analyzing, Error
// If dispatch(action) doesn't work, state transition is invalid
```

### API 401 Unauthorized?
Verify `CASTSENSE_API_KEY`:
```bash
# In .env.local or app.config.js
CASTSENSE_API_KEY=your-key-here
```

### Simulator Can't Reach Backend?
Check [mobile/src/config/api.ts](mobile/src/config/api.ts#L1):
```bash
# Force URL if auto-detection fails
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

### Camera Not Working?
1. Verify permissions in [mobile/app.config.js](mobile/app.config.js#L1)
2. Check iOS `Info.plist` and Android `AndroidManifest.xml`
3. On physical device, user must grant permission in system settings

### Type Errors After Schema Changes?
```bash
make contracts-generate-types  # Regenerates mobile/src/types/contracts.ts
npm run typecheck              # Verify no type errors
```

## Example Prompts for AI Assistance

- "Add a loading spinner in CaptureScreen while uploading."
- "Implement retry button in ErrorScreen that only shows for retryable errors."
- "Create a ResultsList component using LegendList with memoized items for 100+ results."
- "Refactor HomeScreen to show loading state while initializing camera permissions."
- "Fix memory leak: CaptureScreen keeps API subscription after unmount."
- "Optimize ResultsScreen: overlay rendering is jank at 60fps."
- "Add haptic feedback when entering Results state."

## Links

- [Mobile State Machine](mobile/src/state/machine.ts#L1)
- [App Context Provider](mobile/src/state/AppContext.tsx#L1)
- [API Client](mobile/src/services/api.ts#L1)
- [Navigation](mobile/src/navigation/AppNavigator.tsx#L1)
- [React Native Skills](../.agents/skills/vercel-react-native-skills/AGENTS.md)
- [Main Instructions](../.github/copilot-instructions.md)
