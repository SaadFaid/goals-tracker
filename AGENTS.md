# AGENTS.md — august-goals

## Structure

Two independent npm packages, **not** a workspace. Run commands from the correct directory:

- **Frontend** (repo root): Vite + React 19 + Tailwind v4 + Zustand
- **Server** (`server/`): Express + Prisma on Postgres

## Git remotes — two, and both get pushed

- `origin` → `SaadFaid/goals-tracker` (**public**). GitHub Pages serves the built
  bundle from here, and `deploy/goals-stack.sh` auto-pushes to it whenever the
  quick-tunnel URL changes, rewriting the API base in the bundle.
- `private` → `SaadFaid/august-goals` (**private**). This is the real source of
  truth and the repo to clone from.

**Always push to both**: `git push origin master && git push private master`.
Pushing only `origin` leaves the private repo stale, which is the one you would
clone next.

## Secrets never enter the repo — not even a private one

`server/.env` is gitignored by `server/.gitignore`. It holds the Supabase
connection string and both JWT secrets, and it stays that way. GitHub scans
every push, and "private" still means visible to collaborators, org admins and
anyone you later grant access.

`server/.env.example` is the committed template and documents every key, including
`COOKIE_SAME_SITE` / `COOKIE_SECURE`. On a deploy host, keep the real values
outside the working tree and point systemd at them:

```ini
EnvironmentFile=/etc/goals-tracker/secrets.env
```

## Key gotchas

- **No ESLint** — linter is `oxlint` (React plugin). `npm run lint` from root.
- **Tests are pure** — `server/test/` uses `node:test` + `node:assert`. No Jest, no vitest, no DB. `npm test` from `server/`.
- **Calc logic is duplicated, not shared** — `server/src/lib/calc.js` (server) and `src/lib/score.js` (client) are separate implementations. Update **both** when changing calculation logic; server is the tested source of truth. Similarly `src/data/goals.js` mirrors `server/src/seed/defaultCategories.js` reward tier generation for guest mode.
- **Guest-first** — frontend works fully offline in localStorage (`august-goals-guest-v2`). Server sync is optional.
- **Env required for server** — copy `server/.env.example` to `server/.env`. Needs `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`. Docker Compose provides Postgres on :5432.
- **Database is Supabase, not Docker** — `server/.env` points at Supabase's Postgres 17. Bootstrap SQL lives in `server/supabase/schema.sql` (paste into the Supabase SQL Editor). The Docker Compose DB in `server/docker-compose.yml` is now unused; the 8 migrations are baselined as applied against Supabase.
- **The `aws-0-` pooler is the wrong node** — this project's region is `eu-central-1` but its pooler is `aws-1-eu-central-1`, not `aws-0-eu-central-1`. The `aws-0-*` host resolves and accepts TCP, then fails with `ENOTFOUND tenant/user`. Never assume `aws-0`; copy the host from the dashboard's connection string.
- **No IPv6 on this machine** — `db.<ref>.supabase.co` is IPv6-only, so the direct connection is unreachable. Everything must go through the session-mode pooler on port 5432. Do not add `?pgbouncer=true` (that is for transaction mode on 6543).
- **Never point `--shadow-database-url` at Supabase** — `prisma migrate diff` treats it as a throwaway database and its teardown drops `_prisma_migrations`, which silently un-baselines every migration. Use a real scratch DB for shadow work.
- **Auth rate limiting** — 5 requests per 15 minutes on `/api/auth/login` and `/api/auth/register`.
- **`cleanText` must not escape `&`** — `sanitize-html` turns a bare `&` into `&amp;` even with `allowedTags: []`, so every name containing one ("Discipline & Mind") was stored mangled. Both `cleanText` and `cleanUnit` park ampersands behind a sentinel around the call. Nothing here is rendered as HTML, so that escaping was pure data loss. `cleanUnit` additionally skips `.trim()`: units render as `{target}{unit}`, so the leading space in `" sessions"` is what produces "5 sessions".
- **Sync matches on id, never on label** — when a payload carries ids, `pickExisting` matches on id alone. Falling back to the label after a failed id lookup collapsed two same-named rewards (a weekly and a monthly "Full day off") into one row.

## Dev commands

### Frontend (from root)
```bash
npm run dev      # Vite dev server :5173
npm run lint     # oxlint
npm run build    # production build
```

### Server (from server/)
```bash
docker compose up -d   # start Postgres 16 (only if you dropped Supabase)
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
- **Supabase bootstrap SQL**: `server/supabase/schema.sql` — mirrors `schema.prisma` exactly; re-paste it only when creating a brand-new database
- **Auth is not Supabase Auth** — the app does its own bcrypt + JWT. There is no `auth.users` link and RLS is deliberately off, because Prisma connects as `postgres` (BYPASSRLS) and the API layer does all authorization. Enabling RLS without policies will silently break every query.
- **Frontend API base**: `VITE_API_URL || http://localhost:4000/api`
- **CORS origin**: `CLIENT_ORIGIN` env var (default `http://localhost:5173`)
- **`sortOrder` is dropped for categories** — `calculateDashboardState` builds each
  category from an explicit field list, so a field not named there is lost.
  `sortOrder` was missing, which left the client with no way to know a category's
  place or to persist a drag-reorder. Actions and results kept theirs via a `...a`
  spread. Keep new ordering fields out of the blind spot. `fullWidth` (the
  full/half placement toggle) is in the same blind spot and must be named in
  **both** `server/src/lib/calc.js` and `src/lib/score.js`.
- **The tunnel watchdog must not tear down on one failed probe** — a quick tunnel
  needs time to propagate through Cloudflare's edge, and the edge drops the odd
  request. A single `000` used to exit, which became a restart loop that burned a
  new URL, a repoint commit and a Pages rebuild every cycle and left the site down
  more than up. It now needs `WARMUP_FAILS` consecutive failures.
