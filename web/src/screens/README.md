# Screens — Reference

Top-level route components. Each screen maps to one route in `AppRouter`. All screens are exported from `index.ts`.

## `HomeScreen` — `/`

Entry point. Lets the user choose analysis mode (`general` or `specific`), platform context, gear type, user constraints, and target species. Reads available AI models and allows model selection. Emits `selectMode` to the state machine.

Validation errors (missing species, missing photo, invalid manual coordinates) are shown as inline `role="alert"` paragraphs — no native browser dialogs are used.

While analysis runs, a three-stage progress panel is displayed showing `Processing`, `Enriching`, and `Analyzing` steps. Each step renders a `<progress>` element bound to the corresponding progress value from the state machine (`processingProgress`, `enrichmentProgress`, `aiProgress`).

If device GPS is unavailable when using the device location mode, an inline warning is shown and analysis proceeds without location context. Location is optional — the enrichment and prompt stages degrade gracefully when it is absent.

## `CaptureScreen` — `/capture`

Photo capture interface. Accesses the device camera via the `camera` service or opens the media library picker. Displays a viewfinder and triggers the analysis pipeline on photo confirmation. Drives the `startCapture` and `completeCapture` state machine transitions.

## `ResultsScreen` — `/results`

Displays the analysis output. Renders the captured image with an `OverlayCanvas` overlay showing zone polygons, cast arrows, and retrieve paths. Shows `TacticsPanel` for the selected zone and a conditions summary.

Includes a multi-turn follow-up chat panel. The user types a question and the response streams token-by-token via `streamFollowUpQuestion`. Each Q&A exchange is appended to the LangChain conversation memory so subsequent questions have full context. Chat history is shown as styled message bubbles; the textarea submits on Enter (Shift+Enter inserts a newline).

On initial mount, `selectedZoneId` defaults to the first zone. The chat history (`chatMessages`) is local to the component and is not persisted.

## `SettingsScreen` — `/settings`

Manages the BYO OpenAI API key and the selected AI model. Uses `api-key-storage` and `model-storage` services. Calls `fetchAvailableModels` to populate the model list.

Saving an API key validates format inline and displays an error message on failure — no native browser dialog. Clearing the API key uses a two-step in-component confirm flow (`confirmClear` state) rather than `window.confirm`.

## `ErrorScreen` — `/error`

Shows error details from the state machine's `error` field (`code`, `message`). Provides a retry button when `error.retryable` is `true`.
