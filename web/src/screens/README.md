# Screens — Reference

Top-level route components. Each screen maps to one route in `AppRouter`. All screens are exported from `index.ts`.

## `HomeScreen` — `/`

Entry point. Lets the user choose analysis mode (`general` or `specific`), platform context, gear type, user constraints, and target species. Reads available AI models and allows model selection. Emits `selectMode` to the state machine.

## `CaptureScreen` — `/capture`

Photo capture interface. Accesses the device camera via the `camera` service or opens the media library picker. Displays a viewfinder and triggers the analysis pipeline on photo confirmation. Drives the `startCapture` and `completeCapture` state machine transitions.

## `ResultsScreen` — `/results`

Displays the analysis output. Renders the captured image with an `OverlayCanvas` overlay showing zone polygons, cast arrows, and retrieve paths. Shows `TacticsPanel` for the selected zone and a text summary. Supports follow-up questions via the `FollowUp` state.

## `SettingsScreen` — `/settings`

Manages the BYO OpenAI API key and the selected AI model. Uses `api-key-storage` and `model-storage` services. Calls `fetchAvailableModels` to populate the model list.

## `ErrorScreen` — `/error`

Shows error details from the state machine's `error` field (`code`, `message`). Provides a retry button when `error.retryable` is `true`.
