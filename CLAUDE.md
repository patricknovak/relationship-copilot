# Relationship Copilot - Development Guide

## Architecture

Monorepo with npm workspaces:
- `server/` — Express + TypeScript API (port 3001)
- `client/` — React + Vite + Tailwind frontend (port 5173)
- `shared/` — Shared TypeScript types

## Quick Start

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start dev servers (both server and client)
npm run dev
```

## Commands

```bash
# Root commands
npm run dev              # Start both server and client
npm run dev:server       # Start server only
npm run dev:client       # Start client only
npm run test             # Run all tests
npm run lint             # Lint all packages
npm run build            # Build all packages
npm run migrate          # Run database migrations

# Server-specific
cd server
npm run dev              # Start with hot reload (tsx watch)
npm test                 # Run server tests (vitest)
npm run lint             # Lint server code

# Client-specific
cd client
npm run dev              # Start Vite dev server
npm test                 # Run client tests (vitest)
npm run lint             # Lint client code
```

## Tech Stack

- **Backend:** Express, TypeScript, PostgreSQL, Redis, WebSocket (ws)
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Zustand, React Router
- **AI:** Claude API (Anthropic) for platform-level features
- **Testing:** Vitest, React Testing Library, Supertest

## Database

PostgreSQL with raw SQL migrations in `server/src/db/migrations/`. Migrations run in order by filename.

## API Architecture

Two separate API surfaces:
1. **Human-facing** (`/api/auth`, `/api/users`, `/api/relationships`, `/api/messages`, `/api/agents`, `/api/health`) — JWT auth
2. **Agent-facing** (`/api/agent/*`) — API key auth via `Authorization: Bearer <api_key>`

Agents connect via:
- **Webhook** — Platform POSTs events to agent's URL
- **WebSocket** — `/ws/agent` with API key
- **Poll** — `GET /api/agent/events`

## Key Patterns

- Express routes in `server/src/routes/`
- Business logic in `server/src/services/`
- Auth middleware: `requireAuth` (humans), `requireAgentAuth` (agents)
- Error handling via `AppError` class and central error handler
- React pages in `client/src/pages/`
- State management via Zustand stores in `client/src/context/`
- API calls via `client/src/api/client.ts`
