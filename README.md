# august-goals

A personal monthly goals tracker. You build your month out of **categories**, each holding weighted **actions** and **results**. Progress is tracked and turned into a running quality score; as the score or specific tasks reach their targets, **rewards** unlock that you can claim.

## The concept

- **Categories** — the areas of your life you care about (Finance, Health, Learning, Discipline…).
- **Actions** — things you *do* that earn you the score. Each action has a **weight**; all weights in a category must add to 100. Your "execution" score comes from how much of each weighted action you've completed.
- **Results** — outcomes you track, but they don't earn your rating. Execution is what counts.
- **Rewards** — the payoff. Daily/weekly rewards unlock when *all* the tasks of that reset type are complete; monthly rewards unlock at score or revenue thresholds. A reward you claim can be unclaimed/redone.
- **Reset rhythm** — actions reset daily, weekly, monthly, or yearly, so goals roll over the way real life does. At a month boundary you can copy last month's structure forward (progress reset) and keep the same plan.

## Guest-first

The app works entirely in your browser. You can start as a **guest** and everything persists locally; sign in afterwards to sync your goals to your account across devices.

## Monthly snapshots

Each month's layout is saved as a snapshot, so you can look back at past months, view history, restore a prior month, or copy a previous month's goals into a new one.

## Architecture (short version)

Two independent npm packages: the root **frontend** (Vite + React 19 + Tailwind v4 + Zustand) and `server/` (Express + Prisma on Postgres). Guest mode runs offline in `localStorage`; the server is optional sync. The scoring math is mirrored on both sides and must be kept in sync.
