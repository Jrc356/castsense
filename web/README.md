# CastSense Web — Reference

Reference documentation for the `web/` package.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server with HMR on port 5173 |
| `npm run build` | Compile production bundle to `dist/` |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run strict TypeScript type-check (no emit) |
| `npm run test` | Run Vitest suite with coverage |

Prefer `make` targets at the repo root for consistency: `make start`, `make lint`, `make typecheck`, `make test`.

## Source layout

| Path | Purpose |
|---|---|
| `src/main.tsx` | App entry point |
| `src/App.tsx` | Root component |
| `src/components/` | Shared UI components |
| `src/navigation/` | React Router configuration |
| `src/screens/` | Top-level route screens |
| `src/services/` | Analysis pipeline and integration services |
| `src/state/` | App state machine and React context |
| `src/types/contracts.ts` | Authoritative domain types |
| `src/utils/` | Coordinate mapping and geometry utilities |
| `src/styles/` | Shared CSS tokens |
| `src/__tests__/` | Unit tests |

## Type ownership

Domain types are maintained directly in `src/types/contracts.ts`. There is no external contracts generation step. See [src/types/README.md](src/types/README.md) for the full type catalogue.

## API key model

The app requires a BYO OpenAI API key entered in the Settings screen. The key is stored in browser `localStorage` via `src/services/api-key-storage.ts`.

**Security**: `localStorage` is accessible to any JavaScript on the same origin. Before production deployment, move API key handling to a backend proxy with session-based auth and remove browser key storage.

## Environment

No `.env` file is required for local development. The OpenAI API key is entered at runtime in the Settings screen and persisted to `localStorage`.
