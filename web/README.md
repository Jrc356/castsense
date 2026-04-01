# CastSense Web

Responsive web client for CastSense built with React + TypeScript + Vite.

## Commands

- `npm run dev` start development server
- `npm run build` build production bundle
- `npm run lint` run ESLint
- `npm run typecheck` run strict TypeScript checks
- `npm run test` run Vitest suite with coverage

## Security Note

Current migration parity mode stores the BYO OpenAI API key in browser localStorage via `src/services/api-key-storage.ts`.

This is acceptable for local development and parity testing but is not production-safe against XSS. Before production release, move API key handling to a backend proxy with session-based auth and remove browser key storage.
