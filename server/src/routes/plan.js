import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createHttpError, cleanText, isIsoDate, isTime } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

const REPEATS = ["daily", "weekly"];
const TYPES = ["action", "result"];

const isRepeat = (v) => REPEATS.includes(v);
const isType = (v) => TYPES.includes(v);
const isInt = (v) => Number.isInteger(v) && v >= 0 && v <= 1000;

// Resolve the client's category id ("discipline") to a category row owned by this
// user. Returns null for an unknown slug rather than throwing, so a plan survives
// a category the user has since deleted.
async function resolveCategory(userId, legacyCatId) {
  if (!legacyCatId) return null;
  return prisma.category.findFirst({
    where: { userId, slug: legacyCatId },
    select: { id: true },
  });
}

function sanitizeItem(raw, userId, categoryId) {
  if (!raw || typeof raw !== "object") throw createHttpError(400, "Invalid plan item");
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  if (!id) throw createHttpError(400, "Plan item needs an id");
  const label = cleanText(raw.label, 200);
  if (!label) throw createHttpError(400, "Plan item needs a label");
  const date = isIsoDate(raw.date) ? raw.date : null;
  if (!date) throw createHttpError(400, `Plan item ${id} has an invalid date`);
  const legacyCatId = cleanText(raw.catId, 100);
  if (!legacyCatId) throw createHttpError(400, `Plan item ${id} needs a catId`);
  return {
    id,
    userId,
    categoryId,
    legacyCatId,
    type: isType(raw.type) ? raw.type : "action",
    idx: isInt(raw.idx) ? raw.idx : 0,
    label,
    catName: cleanText(raw.catName, 100) || legacyCatId,
    date,
    start: isTime(raw.start) ? raw.start : null,
    end: isTime(raw.end) ? raw.end : null,
    repeat: isRepeat(raw.repeat) ? raw.repeat : "daily",
    repeatDay: Array.isArray(raw.repeatDay)
      ? raw.repeatDay.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [],
    color: cleanText(raw.color, 20) || null,
    note: cleanText(raw.note, 500),
    sortOrder: isInt(raw.sortOrder) ? raw.sortOrder : 0,
  };
}

/** Whole plan for the signed-in account: the live schedule plus the past buffer. */
router.get("/", async (req, res, next) => {
  try {
    const [schedule, past] = await Promise.all([
      prisma.planItem.findMany({
        where: { userId: req.user.id },
        orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.planSnapshot.findMany({
        where: { userId: req.user.id },
        orderBy: [{ date: "asc" }, { seq: "asc" }],
      }),
    ]);
    return res.json({
      schedule: schedule.map((s) => ({
        id: s.id,
        catId: s.legacyCatId,
        type: s.type,
        idx: s.idx,
        label: s.label,
        catName: s.catName,
        date: s.date,
        start: s.start,
        end: s.end,
        repeat: s.repeat,
        repeatDay: s.repeatDay,
        color: s.color,
        note: s.note,
      })),
      past: past.map((p) => ({ date: p.date, seq: p.seq, items: p.items })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Replace the plan. `replace` (default) drops rows the payload no longer has,
 * which is what the client's own save does; `merge` upserts and leaves the rest.
 */
router.put("/", async (req, res, next) => {
  try {
    const { id: userId } = req.user;  // req.user is { id, email }
    const mode = req.body?.mode === "merge" ? "merge" : "replace";
    const rawSchedule = Array.isArray(req.body?.schedule) ? req.body.schedule : null;
    if (!rawSchedule) throw createHttpError(400, "schedule must be an array");
    const rawPast = Array.isArray(req.body?.past) ? req.body.past : [];

    // Cap the payload so one request cannot rewrite the whole table.
    if (rawSchedule.length > 500) throw createHttpError(400, "Too many plan items");
    if (rawPast.length > 200) throw createHttpError(400, "Too many plan snapshots");

    const categories = await prisma.category.findMany({
      where: { userId },
      select: { id: true, slug: true },
    });
    const bySlug = new Map(categories.filter((c) => c.slug).map((c) => [c.slug, c.id]));

    // A repeated id in one payload would make the last write win; reject it
    // rather than silently dropping rows.
    const seen = new Set();
    const items = rawSchedule.map((raw) => {
      const id = typeof raw?.id === "string" ? raw.id : "";
      if (seen.has(id)) throw createHttpError(400, `Duplicate plan item id ${id}`);
      seen.add(id);
      return sanitizeItem(raw, userId, bySlug.get(cleanText(raw?.catId, 100)) ?? null);
    });

    const result = await prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        // The client always PUTs the whole schedule, so drop and reinsert in two
        // statements. A per-row findFirst+create loop is slow enough through the
        // pooler to hit the interactive-transaction timeout on a large plan.
        await tx.planItem.deleteMany({ where: { userId } });
        if (items.length) {
          await tx.planItem.createMany({
            data: items.map(({ userId: _u, categoryId, ...rest }) => ({
              ...rest,
              userId,
              categoryId,
            })),
            skipDuplicates: true,
          });
        }
        await tx.planSnapshot.deleteMany({ where: { userId } });
        if (rawPast.length) {
          await tx.planSnapshot.createMany({
            data: rawPast.map((snap, i) => ({
              userId,
              date: Array.isArray(snap) && isIsoDate(snap[0]?.date) ? snap[0].date : "1970-01-01",
              seq: i,
              items: Array.isArray(snap) ? snap : [],
            })),
          });
        }
      } else {
        for (const item of items) {
          const existing = await tx.planItem.findFirst({
            where: { id: item.id, userId },
            select: { id: true },
          });
          const { userId: _ignored, categoryId, ...fields } = item;
          const data = {
            ...fields,
            user: { connect: { id: userId } },
            ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
          };
          if (existing) await tx.planItem.update({ where: { id: item.id }, data });
          else await tx.planItem.create({ data });
        }
      }
      return {
        schedule: items.length,
        past: rawPast.length,
        unresolvedCategories: [...new Set(items.filter((i) => !i.categoryId).map((i) => i.legacyCatId))],
      };
    }, { timeout: 30000 });

    return res.json({ saved: result });
  } catch (err) {
    next(err);
  }
});

/** Add or update a single block. */
router.post("/", async (req, res, next) => {
  try {
    const { id: userId } = req.user;  // req.user is { id, email }
    const legacyCatId = cleanText(req.body?.catId, 100);
    const category = await resolveCategory(userId, legacyCatId);
    const item = sanitizeItem(req.body, userId, category?.id ?? null);
    const existing = await prisma.planItem.findFirst({
      where: { id: item.id, userId },
      select: { id: true },
    });
    const saved = existing
      ? await prisma.planItem.update({ where: { id: item.id }, data: item })
      : await prisma.planItem.create({ data: item });
    return res.status(existing ? 200 : 201).json({ item: saved });
  } catch (err) {
    next(err);
  }
});

/** Delete one block. 404 when it belongs to another account. */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id: userId } = req.user;  // req.user is { id, email }
    const { count } = await prisma.planItem.deleteMany({ where: { id: String(req.params.id), userId } });
    if (!count) throw createHttpError(404, "Plan item not found");
    return res.json({ deleted: 1 });
  } catch (err) {
    next(err);
  }
});

export default router;
