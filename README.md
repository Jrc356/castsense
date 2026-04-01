# CastSense

A responsive web AI fishing assistant. Point your camera at a fishing scene and CastSense returns cast recommendations, zone overlays, and rig tactics — powered by your own OpenAI API key.

## Project structure

| Folder | Purpose |
|---|---|
| `web/` | React + TypeScript + Vite frontend |
| `backend/` | Node.js service; serves health check and production web build |
| `web/src/types/contracts.ts` | Authoritative app domain types (maintained locally) |

## How to run locally

1. Install dependencies:

   ```
   make install
   ```

2. Start the web development server:

   ```
   make start
   ```

   Opens [http://localhost:5173](http://localhost:5173).

3. Run quality checks:

   ```
   make lint
   make typecheck
   make test
   ```

## How to run with Docker Compose

1. Build and start services with hot reloading:

   ```
   docker-compose up --build
   ```

   - Web (Vite HMR): [http://localhost:5173](http://localhost:5173)
   - Backend health: [http://localhost:3000/health](http://localhost:3000/health)

   Source changes reload automatically: `web/src` via Vite HMR, `backend/src` via process restart.

2. Stop services:

   ```
   docker-compose down
   ```

## How to smoke-test a production build

```
make start-single
```

Compiles the web bundle and serves it from the backend at [http://localhost:3000](http://localhost:3000). Simulates the single-service production layout.

## Further reading

- [web/README.md](web/README.md) — web package commands, source layout, API key model, security notes
