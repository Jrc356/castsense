# About the CastSense state machine

The app's UI flow is governed by an explicit finite state machine defined in `machine.ts` and provided to components through a React Context in `AppContext.tsx`.

## Why an explicit state machine?

Fishing analysis involves a multi-step async pipeline: capture → image processing → metadata enrichment → AI inference → results. Each step has distinct loading states, progress values, and failure modes.

Without explicit states it is easy to build contradictory UI — for example, allowing a second analysis to start while one is already in progress, or showing a results screen before any results have arrived. An explicit machine prevents this by making illegal transitions structurally impossible.

## States and their meaning

```
Idle → ModeSelected → Capturing → ReadyToAnalyze
     → Processing → Enriching → Analyzing → Results
                                           → FollowUp
                              → Error
```

| State | What it represents |
|---|---|
| `Idle` | Initial state; no analysis in progress |
| `ModeSelected` | User has chosen general or species-specific mode |
| `Capturing` | Camera active; waiting for the user to take a photo |
| `ReadyToAnalyze` | Photo captured; user can review before submitting |
| `Processing` | Image is being downscaled and prepared |
| `Enriching` | Metadata (GPS, weather, solar) is being collected |
| `Analyzing` | LangChain + OpenAI call in progress |
| `Results` | Analysis complete; results are displayed |
| `FollowUp` | User is asking a follow-up question in the current session |
| `Error` | Pipeline error; error details available for display and optional retry |

## Guard conditions

`machine.ts` exports three guard functions that the context and UI use to gate actions:

- `canStartCapture` — `true` only in `ModeSelected`
- `canStartAnalysis` — `true` only in `ReadyToAnalyze`
- `canRetry` — `true` only in `Error` when `error.retryable` is `true`

These guards prevent components from needing to inspect raw state enum strings.

## Design decisions

**Single reducer, no side effects.** The reducer is a pure function. All async work happens outside (in services and the analysis orchestrator) and results are dispatched as completion events. This makes the state transitions deterministic and easy to test.

**Progress values are first-class state.** The three progress fields (`processingProgress`, `enrichmentProgress`, `aiProgress`) live in the machine because they drive live UI. Keeping them in the reducer ensures React re-renders are driven by a single source of truth, not scattered across `useEffect` hooks.

**Context wraps machine.** `AppContext.tsx` exposes typed action creators (`selectMode`, `startCapture`, `receiveResults`, etc.) rather than raw dispatch. Components never import action type strings, which keeps the action vocabulary in one place.

## Further reading

- `machine.ts` — state types, reducer, guard functions, and initial state
- `AppContext.tsx` — React context, action creators, and model persistence side effects
- [services/README.md](../services/README.md) — the async services that dispatch into this machine
