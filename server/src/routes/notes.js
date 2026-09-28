import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createHttpError, cleanText, isIsoDate } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

const MAX_TEXT = 1000;
const isInt = (v) => Number.isInteger(v) && v >= 0 && v <= 100000;

function sanitizeNote(raw, where) {
  if (!raw || typeof raw !== "object") throw createHttpError(400, "Invalid note");
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  if (!id) throw createHttpError(400, "Note needs an id");
  const text = cleanText(raw.text, MAX_TEXT);
  if (!text) throw createHttpError(400, `Note ${id} is empty`);
  return {
    id,
    ...where,
    text,
    done: !!raw.done,
    sortOrder: isInt(raw.sortOrder) ? raw.sortOrder : 0,
  };
}

/**
 * Everything notes-related for the signed-in account: the standing list, the
 * per-day history map, and the lastDay/seeded scalars the client keeps with it.
 */
router.get("/", async (req, res, next) => {
  try {
    const { id: userId } = req.user;  // req.user is { id, email }
    const [notes, days, state] = await Promise.all([
      prisma.note.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.noteDay.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { sortOrder: "asc" }] }),
      prisma.noteDayState.findUnique({ where: { userId } }),
    ]);

    const map = {};
    for (const d of days) {
      (map[d.date] ||= []).push({ id: d.noteId, text: d.text, done: d.done });
    }
    return res.json({
      notes: notes.map((n) => ({ id: n.id, text: n.text, done: n.done })),
      days: {
        lastDay: state?.lastDay ?? null,
        seeded: state?.seeded ?? false,
        map,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Replace the notes. `replace` (default) mirrors the client's own save and drops
 * anything the payload no longer contains; `merge` upserts by (date, noteId).
 */
router.put("/", async (req, res, next) => {
  try {
    const { id: userId } = req.user;  // req.user is { id, email }
    const mode = req.body?.mode === "merge" ? "merge" : "replace";
    const rawNotes = Array.isArray(req.body?.notes) ? req.body.notes : null;
    if (!rawNotes) throw createHttpError(400, "notes must be an array");
    const rawMap = req.body?.days?.map;
    if (rawMap != null && (typeof rawMap !== "object" || Array.isArray(rawMap))) {
      throw createHttpError(400, "days.map must be an object");
    }
    if (rawNotes.length > 500) throw createHttpError(400, "Too many notes");

    // sortOrder comes from the array index: the client stores its lists in
    // display order and every note arrives with sortOrder 0, so without this the
    // order Postgres returns ties in is arbitrary and the list reshuffles
    // between requests.
    const notes = rawNotes.map((raw, i) => ({
      ...sanitizeNote(raw, { userId }),
      sortOrder: raw?.sortOrder == null ? i : isInt(raw.sortOrder) ? raw.sortOrder : i,
    }));

    const dayRows = [];
    if (rawMap) {
      for (const [date, list] of Object.entries(rawMap)) {
        if (!isIsoDate(date)) throw createHttpError(400, `Invalid notes day ${date}`);
        if (!Array.isArray(list)) throw createHttpError(400, `Notes day ${date} must be an array`);
        if (list.length > 200) throw createHttpError(400, `Too many notes on ${date}`);
        const seen = new Set();
        list.forEach((raw, i) => {
          const row = sanitizeNote(raw, { userId, date });
          row.sortOrder = raw?.sortOrder == null ? i : isInt(raw.sortOrder) ? raw.sortOrder : i;
          if (seen.has(row.id)) throw createHttpError(400, `Duplicate note id ${row.id} on ${date}`);
          seen.add(row.id);
          // NoteDay has its own row uuid plus noteId, which is the note's client
          // id and the column the unique key is built on.
          dayRows.push({ ...row, noteId: row.id });
        });
      }
    }

    const lastDay = req.body?.days?.lastDay;
    if (lastDay != null && lastDay !== "" && !isIsoDate(lastDay)) {
      throw createHttpError(400, "Invalid days.lastDay");
    }

    const saved = await prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.note.deleteMany({ where: { userId } });
        await tx.noteDay.deleteMany({ where: { userId } });
      }
      if (mode === "replace") {
        // Bulk insert. Per-row findFirst+create was ~110 round trips through the
        // pooler and blew the interactive-transaction timeout on a normal payload.
        if (notes.length) await tx.note.createMany({ data: notes });
        if (dayRows.length) {
          await tx.noteDay.createMany({
            data: dayRows.map(({ userId: _u, date, ...rest }) => ({ ...rest, userId, date })),
            skipDuplicates: true,
          });
        }
      } else {
        for (const n of notes) {
          await tx.note.upsert({
            where: { userId_id: { userId, id: n.id } },
            create: n,
            update: n,
          });
        }
        for (const d of dayRows) {
          await tx.noteDay.upsert({
            where: { userId_date_noteId: { userId, date: d.date, noteId: d.id } },
            create: { id: d.id, userId, date: d.date, noteId: d.id, text: d.text, done: d.done, sortOrder: d.sortOrder },
            update: { text: d.text, done: d.done, sortOrder: d.sortOrder },
          });
        }
      }
      if (lastDay) {
        await tx.noteDayState.upsert({
          where: { userId },
          create: { userId, lastDay, seeded: !!req.body?.days?.seeded },
          update: { lastDay, seeded: !!req.body?.days?.seeded },
        });
      }
      return { notes: notes.length, days: dayRows.length, dayCount: Object.keys(rawMap || {}).length };
    }, { timeout: 30000 });

    return res.json({ saved });
  } catch (err) {
    next(err);
  }
});

/** Toggle or edit a single standing note. */
router.post("/", async (req, res, next) => {
  try {
    const { id: userId } = req.user;  // req.user is { id, email }
    const note = sanitizeNote(req.body, { userId });
    const exists = await prisma.note.findFirst({ where: { id: note.id, userId }, select: { id: true } });
    const saved = exists
      ? await prisma.note.update({ where: { id: note.id }, data: note })
      : await prisma.note.create({ data: { ...note, user: { connect: { id: userId } } } });
    return res.status(exists ? 200 : 201).json({ note: saved });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id: userId } = req.user;  // req.user is { id, email }
    const { count } = await prisma.note.deleteMany({ where: { id: String(req.params.id), userId } });
    if (!count) throw createHttpError(404, "Note not found");
    return res.json({ deleted: 1 });
  } catch (err) {
    next(err);
  }
});

export default router;
