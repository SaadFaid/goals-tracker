# august-goals

A personal monthly goals tracker. Set categories, give each action a weight, track progress, and earn rewards as you hit targets. Runs fully in your browser as a guest, or sign in to sync across devices.

## Stack

- **Frontend** — Vite + React 19 + Tailwind v4 + Zustand (guest-first, optimistic updates)
- **Backend** — Express + Prisma (Postgres) JSON API

The repo has two independent npm packages: the root frontend and `server/`. They are **not** a workspace — run commands in the right directory.

## Frontend (from repo root)

```bash
npm install
npm run dev      # Vite on :5173
npm run lint     # oxlint
npm run build    # production build
```

## Server (from `server/`)

```bash
cp .env.example .env   # fill in JWT secrets
docker compose up -d   # Postgres 16
npm run migrate        # prisma migrate dev
npm run seed           # demo user + categories
npm run dev            # API on :4000
```

Useful scripts:

```bash
npm test            # unit tests (node:test, no DB required)
npm run generate    # rebuild Prisma client after schema changes
npm run add-rewards # refresh reward tiers on existing accounts
npm run studio      # Prisma Studio
```

The frontend calls the API at `VITE_API_URL || http://localhost:4000/api`. In dev, point `CLIENT_ORIGIN=http://localhost:5173` for CORS and the refresh-token cookie.

## Guest mode

Everything works offline in the browser. Guest data persists to `localStorage` (key `august-goals-guest-v2`). Sign in when you want to sync to the server.

## Rewards

Rewards unlock as you complete actions or hit score thresholds. Daily/weekly rewards unlock when all actions of that reset type are complete. Tier templates live in `generateRewardTiers` on both the client (`src/data/goals.js`) and server (`server/src/seed/defaultCategories.js`).
