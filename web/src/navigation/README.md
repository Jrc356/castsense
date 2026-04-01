# Navigation — Reference

Client-side routing is implemented with React Router v6 in `AppRouter.tsx`.

## Routes

| Path | Screen | Description |
|---|---|---|
| `/` | `HomeScreen` | Landing page; mode and gear selection |
| `/capture` | `CaptureScreen` | Camera capture and photo review |
| `/results` | `ResultsScreen` | Zone overlay and tactics display |
| `/settings` | `SettingsScreen` | API key and model selection |
| `/error` | `ErrorScreen` | Pipeline error display |

## `AppRouter`

Renders the full app shell: `<BrowserRouter>`, the topbar header with brand mark and navigation links, and a `<Routes>` block mapping paths to screens.

The topbar uses `NavLink` for navigation; the active link receives the `active` CSS class.

Programmatic navigation (e.g. after analysis completes) is performed by screens using `useNavigate` from React Router — not inside `AppRouter` itself.
