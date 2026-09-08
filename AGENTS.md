# AGENTS.md — august-goals

## Structure

Two independent npm packages, **not** a workspace. Run commands from the correct directory:

- **Frontend** (repo root): Vite + React 19 + Tailwind v4 + Zustand
- **Server** (`server/`): Express + Prisma on Postgres

## Key gotchas

- **No ESLint** — linter is `oxlint` (React plugin). `npm run lint` from root.
- **Tests are pure** — `server/test/` uses `node:test` + `node:assert`. No Jest, no vitest, no DB. `npm test` from `server/`.
- **Calc logic is duplicated, not shared** — `server/src/lib/calc.js` (server) and `src/lib/score.js` (client) are separate implementations. Update **both** when changing calculation logic; server is the tested source of truth. Similarly `src/data/goals.js` mirrors `server/src/seed/defaultCategories.js` reward tier generation for guest mode.
- **Guest-first** — frontend works fully offline in localStorage (`august-goals-guest-v2`). Server sync is optional.
- **Env required for server** — copy `server/.env.example` to `server/.env`. Needs `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`. Docker Compose provides Postgres on :5432.
- **Auth rate limiting** — 5 requests per 15 minutes on `/api/auth/login` and `/api/auth/register`.

## Dev commands

### Frontend (from root)
```bash
npm run dev      # Vite dev server :5173
npm run lint     # oxlint
npm run build    # production build
```

### Server (from server/)
```bash
docker compose up -d   # start Postgres 16
cp .env.example .env   # fill JWT secrets
npm run migrate        # prisma migrate dev
npm run generate       # rebuild Prisma client after schema changes
npm run seed           # demo user + categories
npm run add-rewards    # add reward tiers to seed data
npm run dev            # API :4000 (node --watch)
npm test               # unit tests (node:test, no DB)
```

## Architecture

- **Frontend state**: Zustand store (`src/store/useGoalsStore.js`)
- **Server entry**: `server/src/index.js` — Express with helmet, CORS, cookie-parser, rate limiting
- **Server routes**: `server/src/routes/` (auth, categories, actions, results, rewards, progress, snapshots, sync, dashboard)
- **Prisma schema**: `server/prisma/schema.prisma` — run `npm run migrate` after changes, `npm run generate` to rebuild client
- **Frontend API base**: `VITE_API_URL || http://localhost:4000/api`
- **CORS origin**: `CLIENT_ORIGIN` env var (default `http://localhost:5173`)
