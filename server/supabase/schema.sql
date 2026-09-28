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
