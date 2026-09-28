-- goals-tracker / august-goals — Supabase schema
-- Paste into Supabase Dashboard → SQL Editor → Run.
--
-- Mirrors server/prisma/schema.prisma exactly (quoted CamelCase identifiers,
-- TEXT ids, TIMESTAMP(3)) so Prisma sees zero drift against this database.
--
-- Auth note: this app does its own auth (bcrypt + JWT, server/src/lib/auth.js).
-- There is NO link to auth.users and RLS is intentionally OFF — Prisma connects
-- as the postgres role (BYPASSRLS) and does all authorization in the API layer.

-- ---------------------------------------------------------------- tables

CREATE TABLE "User" (
    "id"          TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name"        TEXT NOT NULL DEFAULT 'User',
    "timezone"    TEXT NOT NULL DEFAULT 'UTC',
    "monthOffset" INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
    "id"        TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
    "id"        TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    -- Stable identifier used to resolve plan rows to a category by name.
    "slug"      TEXT,
    "dotColor"  TEXT NOT NULL DEFAULT 'turquoise',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "expanded"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Action" (
    "id"          TEXT NOT NULL,
    "categoryId"  TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "weight"      INTEGER NOT NULL,
    "current"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target"      DOUBLE PRECISION NOT NULL,
    "unit"        TEXT,
    "incrementBy" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "resetType"   TEXT NOT NULL DEFAULT 'monthly',
    "actionType"  TEXT NOT NULL DEFAULT 'count',
    "invert"      BOOLEAN NOT NULL DEFAULT false,
    "lastResetAt" TIMESTAMP(3),
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Result" (
    "id"         TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "current"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target"     DOUBLE PRECISION NOT NULL,
    "unit"       TEXT,
    "weight"     INTEGER NOT NULL DEFAULT 0,
    "invert"     BOOLEAN NOT NULL DEFAULT false,
    "isBadge"    BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reward" (
    "id"             TEXT NOT NULL,
    "categoryId"     TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "cost"           DOUBLE PRECISION NOT NULL,
    "thresholdType"  TEXT NOT NULL DEFAULT 'score',
    "period"         TEXT NOT NULL DEFAULT 'monthly',
    "linkedActionId" TEXT,
    "linkedResultId" TEXT,
    "linkedPercent"  DOUBLE PRECISION DEFAULT 100,
    "price"          DOUBLE PRECISION,
    "claimed"        BOOLEAN NOT NULL DEFAULT false,
    "claimedAt"      TIMESTAMP(3),
    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressLog" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "date"          DATE NOT NULL,
    "dayOfMonth"    INTEGER NOT NULL,
    "month"         INTEGER NOT NULL,
    "year"          INTEGER NOT NULL,
    "qualityScore"  DOUBLE PRECISION NOT NULL,
    "expectedScore" DOUBLE PRECISION NOT NULL,
    "resultsScore"  DOUBLE PRECISION,
    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlySnapshot" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "month"     TEXT NOT NULL,
    "data"      JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonthlySnapshot_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------- indexes

CREATE UNIQUE INDEX "User_email_key"                ON "User"("email");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX        "PasswordResetToken_userId_idx"  ON "PasswordResetToken"("userId");
CREATE INDEX        "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE UNIQUE INDEX "RefreshToken_token_key"        ON "RefreshToken"("token");
CREATE INDEX        "RefreshToken_userId_idx"       ON "RefreshToken"("userId");
CREATE INDEX        "Category_userId_sortOrder_idx" ON "Category"("userId", "sortOrder");
CREATE INDEX        "Action_categoryId_sortOrder_idx"  ON "Action"("categoryId", "sortOrder");
CREATE INDEX        "Result_categoryId_sortOrder_idx"  ON "Result"("categoryId", "sortOrder");
CREATE INDEX        "Reward_categoryId_idx"         ON "Reward"("categoryId");
CREATE UNIQUE INDEX "ProgressLog_userId_date_key"   ON "ProgressLog"("userId", "date");
CREATE INDEX        "ProgressLog_userId_year_month_idx" ON "ProgressLog"("userId", "year", "month");
CREATE UNIQUE INDEX "MonthlySnapshot_userId_month_key" ON "MonthlySnapshot"("userId", "month");
CREATE INDEX        "MonthlySnapshot_userId_month_idx" ON "MonthlySnapshot"("userId", "month");

-- ---------------------------------------------------------------- foreign keys

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Action" ADD CONSTRAINT "Action_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Result" ADD CONSTRAINT "Result_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reward" ADD CONSTRAINT "Reward_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlySnapshot" ADD CONSTRAINT "MonthlySnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Plan (daily schedule blocks) ──────────────────────────────────────────
-- Every one of these tables is keyed by userId with ON DELETE CASCADE, so
-- deleting an account removes its plan/notes/pomodoro rows. The API layer reads
-- userId from the verified JWT and never from the request body, which is the
-- only authorization boundary here (RLS is off because Prisma connects as a
-- BYPASSRLS role).

CREATE TABLE "PlanItem" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "categoryId" TEXT,
    -- The client's own category id, kept so a renamed category still renders.
    "legacyCatId" TEXT NOT NULL,
    "type"       TEXT NOT NULL DEFAULT 'habit',
    "idx"        INTEGER NOT NULL DEFAULT 0,
    "label"      TEXT,
    "catName"    TEXT,
    "color"      TEXT,
    "note"       TEXT,
    "date"       TEXT NOT NULL,
    "start"      TEXT,
    "end"        TEXT,
    "repeat"     TEXT NOT NULL DEFAULT 'today',
    "repeatDay"  INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("id"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PlanItem_userId_date_idx" ON "PlanItem"("userId", "date");

-- One archived day's schedule. `seq` preserves the order of multiple snapshots
-- taken on the same date.
CREATE TABLE "PlanSnapshot" (
    "id"     TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date"   TEXT NOT NULL,
    "seq"    INTEGER NOT NULL DEFAULT 0,
    "items"     JSONB NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("id"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PlanSnapshot_userId_date_idx" ON "PlanSnapshot"("userId", "date");

-- ── Notes ────────────────────────────────────────────────────────────────
-- The standing checklist. The primary key is (userId, id), NOT id alone, so the
-- same client-generated note id in two accounts is two independent rows rather
-- than a cross-account collision.
CREATE TABLE "Note" (
    "userId"    TEXT NOT NULL,
    "id"        TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "done"      BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "id"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One day's archived checklist, kept so past days can be reopened.
CREATE TABLE "NoteDay" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "date"      TEXT NOT NULL,
    "noteId"    TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "done"      BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("id"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NoteDay_userId_date_noteId_key" ON "NoteDay"("userId", "date", "noteId");
CREATE INDEX "NoteDay_userId_date_idx" ON "NoteDay"("userId", "date");

-- Tracks which day the day-rollover archive last ran, so reopening the app
-- archives the previous day exactly once.
CREATE TABLE "NoteDayState" (
    "userId"  TEXT NOT NULL,
    "lastDay" TEXT NOT NULL,
    "seeded"  BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("userId"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ── Pomodoro ─────────────────────────────────────────────────────────────
-- Durations plus running-timer state, so a reload on another device resumes
-- where the previous one left off.
CREATE TABLE "PomodoroSettings" (
    "userId"    TEXT NOT NULL,
    "workM"     INTEGER NOT NULL DEFAULT 25,
    "breakM"    INTEGER NOT NULL DEFAULT 5,
    "soundId"   TEXT NOT NULL DEFAULT 'chime',
    "phase"     TEXT NOT NULL DEFAULT 'work',
    "pomodoros" INTEGER NOT NULL DEFAULT 0,
    "repeat"    BOOLEAN NOT NULL DEFAULT true,
    "mode"      TEXT NOT NULL DEFAULT 'focus',
    "fRunning"  BOOLEAN NOT NULL DEFAULT false,
    "fEndAt"    TIMESTAMP,
    "fHold"     INTEGER NOT NULL DEFAULT 0,
    "tH"        INTEGER NOT NULL DEFAULT 0,
    "tM"        INTEGER NOT NULL DEFAULT 0,
    "tS"        INTEGER NOT NULL DEFAULT 0,
    "tRunning"  BOOLEAN NOT NULL DEFAULT false,
    "tEndAt"    TIMESTAMP,
    "tHold"     INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId"),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Category slug is per-user unique: the same category name in two accounts is
-- two rows with the same slug.
CREATE UNIQUE INDEX "Category_userId_slug_key" ON "Category"("userId", "slug");
