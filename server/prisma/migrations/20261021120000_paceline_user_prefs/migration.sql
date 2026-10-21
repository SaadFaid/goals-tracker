-- Paceline: two additive, nullable/defaulted columns on User. No existing column
-- changes, no data backfill, no new table.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "hideFromLeaderboard" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "settings" JSONB;
