-- Per-account planner, notes and pomodoro state, so a signed-in account keeps
-- this data per user instead of only in one browser's localStorage.
--
-- Every table below carries "userId" with ON DELETE CASCADE, so removing an
-- account removes its planner/notes/pomodoro rows and can never leave them
-- attached to, or readable by, another account. The route layer derives userId
-- from the verified JWT for every query; the client cannot choose it.

-- Category gains the client's stable id so plan items can be re-resolved after a
-- rename. Unique per user, and nullable because seeded categories have no slug.
ALTER TABLE "Category" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Category_userId_slug_key" ON "Category"("userId", "slug");

CREATE TABLE "PlanItem" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "categoryId"  TEXT,
    "legacyCatId" TEXT NOT NULL,
    "type"        TEXT NOT NULL DEFAULT 'action',
    "idx"         INTEGER NOT NULL DEFAULT 0,
    "label"       TEXT NOT NULL,
    "catName"     TEXT NOT NULL,
    "date"        TEXT NOT NULL,
    "start"       TEXT,
    "end"         TEXT,
    "repeat"      TEXT NOT NULL DEFAULT 'daily',
    "repeatDay"   INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "color"       TEXT,
    "note"        TEXT,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanSnapshot" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "date"      TEXT NOT NULL,
    "seq"       INTEGER NOT NULL DEFAULT 0,
    "items"     JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Note" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "done"      BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteDay" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "date"      TEXT NOT NULL,
    "noteId"    TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "done"      BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "NoteDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoteDayState" (
    "userId"  TEXT NOT NULL,
    "lastDay" TEXT NOT NULL,
    "seeded"  BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "NoteDayState_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "PomodoroSettings" (
    "userId"    TEXT NOT NULL,
    "workM"     INTEGER NOT NULL DEFAULT 25,
    "breakM"    INTEGER NOT NULL DEFAULT 5,
    "soundId"   TEXT NOT NULL DEFAULT 'chime',
    "phase"     TEXT NOT NULL DEFAULT 'focus',
    "pomodoros" INTEGER NOT NULL DEFAULT 0,
    "repeat"    BOOLEAN NOT NULL DEFAULT true,
    "mode"      TEXT NOT NULL DEFAULT 'focus',
    "fRunning"  BOOLEAN NOT NULL DEFAULT false,
    "fEndAt"    TIMESTAMP(3),
    "fHold"     INTEGER NOT NULL DEFAULT 0,
    "tH"        INTEGER NOT NULL DEFAULT 0,
    "tM"        INTEGER NOT NULL DEFAULT 0,
    "tS"        INTEGER NOT NULL DEFAULT 0,
    "tRunning"  BOOLEAN NOT NULL DEFAULT false,
    "tEndAt"    TIMESTAMP(3),
    "tHold"     INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PomodoroSettings_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "PlanItem_userId_date_idx" ON "PlanItem"("userId", "date");
CREATE INDEX "PlanItem_userId_categoryId_idx" ON "PlanItem"("userId", "categoryId");
CREATE INDEX "PlanSnapshot_userId_date_idx" ON "PlanSnapshot"("userId", "date");
CREATE INDEX "Note_userId_idx" ON "Note"("userId");
CREATE INDEX "NoteDay_userId_date_idx" ON "NoteDay"("userId", "date");
CREATE UNIQUE INDEX "NoteDay_userId_date_noteId_key" ON "NoteDay"("userId", "date", "noteId");

ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanSnapshot" ADD CONSTRAINT "PlanSnapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteDay" ADD CONSTRAINT "NoteDay_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoteDayState" ADD CONSTRAINT "NoteDayState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PomodoroSettings" ADD CONSTRAINT "PomodoroSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
