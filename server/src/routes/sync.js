import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { recomputeAndLog } from "./dashboard.js";
import {
  cleanText, cleanUnit, isDotColor, isWeight, isPositiveNumber, isNonNegativeNumber,
  isOneOf, isPercent, isMonthKey,
  RESET_TYPES, ACTION_TYPES, THRESHOLD_TYPES, REWARD_PERIODS,
} from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

const toDate = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Local guest ids are client-generated uuids that never exist in the database,
// so every matched/created child is recorded here to let rewards resolve their
// linkedActionId / linkedResultId against real rows.
const key = (v) => (typeof v === "string" && v ? v : null);

// When the payload carries ids, match on id and nothing else. Falling back to
// the label after a failed id lookup made two same-named rewards ("Full day
// off" weekly + monthly) collapse into one row, with the second overwriting the
// first. The name/target heuristic only applies to payloads that predate ids,
// where there is no id to trust.
const pickExisting = (rows, localId, fallbackMatch) =>
  key(localId)
    ? rows.find((x) => x.id === localId) || null
    : rows.find(fallbackMatch) || null;

/**
 * Merge a full local payload (from guest mode) into the authenticated user's data.
 * Categories match by id then name; children match by id then (label, target).
 * Every field the client stores is persisted — anything omitted here is data loss
 * on import, so defaults are only ever a fallback for a missing/garbage value.
 */
router.post("/", async (req, res, next) => {
  const { mode = "merge" } = req.body;
  const payload = Array.isArray(req.body.categories) ? req.body.categories : [];
  const stats = { categories: 0, actions: 0, results: 0, rewards: 0, progressLogs: 0, snapshots: 0, skipped: 0, cleared: 0 };

  try {
    if (mode === "discard") {
      const dashboard = await recomputeAndLog(req.user.id);
      return res.json({ ok: true, mode, imported: stats, dashboard });
    }

    // "replace" exists because registration seeds ~28 demo categories. Merging a
    // real import on top of those leaves the user staring at fake goals, so this
    // mode drops the seeded graph first. Progress logs and snapshots are kept
    // unless the payload carries replacements, since those are genuine history.
    if (mode === "replace") {
      const { count } = await prisma.category.deleteMany({ where: { userId: req.user.id } });
      stats.cleared = count;
    }

    const existing = await prisma.category.findMany({
      where: { userId: req.user.id },
      include: { actions: true, results: true, rewards: true },
    });

    let sortOrder = existing.length;
    for (const localCat of payload) {
      const name = cleanText(localCat?.name, 100);
      if (!name) { stats.skipped++; continue; }

      let dbCat = pickExisting(existing, localCat.id, (c) => c.name === name);
      // The client's category id ("discipline") is what PlanItem.catId refers to,
      // so keep it as the slug. Uniqueness is scoped per user, and a second import
      // that leaves the column null must not trip the unique index.
      const slug = cleanText(localCat.id, 100) || null;
      if (!dbCat) {
        dbCat = await prisma.category.create({
          data: {
            userId: req.user.id,
            name,
            slug,
            dotColor: isDotColor(localCat.dotColor) ? localCat.dotColor : "turquoise",
            sortOrder: sortOrder++,
            expanded: localCat.expanded !== false,
            fullWidth: localCat.fullWidth === true,
          },
        });
        // dbCat is the working copy below, so seed its child collections before
        // appending — a freshly created row has none of them.
        dbCat.actions = [];
        dbCat.results = [];
        dbCat.rewards = [];
        existing.push(dbCat);
        stats.categories++;
      } else if (slug && !dbCat.slug) {
        // Backfill the slug on a category that predates the column, so plan items
        // can resolve their catId.
        dbCat = await prisma.category.update({
          where: { id: dbCat.id },
          data: { slug },
          include: { actions: true, results: true, rewards: true },
        });
        const at = existing.findIndex((c) => c.id === dbCat.id);
        if (at >= 0) existing[at] = dbCat;
      }

      const actionIds = new Map();
      const resultIds = new Map();

      for (const a of localCat.actions || []) {
        const label = cleanText(a?.label, 100);
        if (!label || !isWeight(a.weight) || !isPositiveNumber(a.target)) { stats.skipped++; continue; }
        const found = pickExisting(
          dbCat.actions, a.id, (x) => x.label === label && x.target === a.target
        );
        const fields = {
          current: isNonNegativeNumber(a.current) ? a.current : 0,
          label,
          weight: a.weight,
          target: a.target,
          unit: cleanUnit(a.unit, 50) || null,
          incrementBy: isPositiveNumber(a.incrementBy) ? a.incrementBy : 1,
          resetType: isOneOf(a.resetType, RESET_TYPES, "monthly"),
          actionType: isOneOf(a.actionType, ACTION_TYPES, "count"),
          invert: !!a.invert,
          lastResetAt: toDate(a.lastResetAt),
          sortOrder: found?.sortOrder ?? dbCat.actions.length,
        };
        const saved = found
          ? await prisma.action.update({ where: { id: found.id }, data: fields })
          : await prisma.action.create({ data: { categoryId: dbCat.id, ...fields } });
        if (!found) { dbCat.actions.push(saved); stats.actions++; }
        if (key(a.id)) actionIds.set(a.id, saved.id);
      }

      for (const r of localCat.results || []) {
        const label = cleanText(r?.label, 100);
        if (!label || !isPositiveNumber(r.target)) { stats.skipped++; continue; }
        const found = pickExisting(
          dbCat.results, r.id, (x) => x.label === label && x.target === r.target
        );
        const fields = {
          current: isNonNegativeNumber(r.current) ? r.current : 0,
          label,
          target: r.target,
          unit: cleanUnit(r.unit, 50) || null,
          // Results carry a weight just like actions. calc.js folds it into both
          // the numerator and the denominator, so a missing value here rescales
          // the whole score rather than just dropping one row.
          weight: isWeight(r.weight) ? r.weight : 0,
          invert: !!r.invert,
          isBadge: !!r.isBadge,
          sortOrder: found?.sortOrder ?? dbCat.results.length,
        };
        const saved = found
          ? await prisma.result.update({ where: { id: found.id }, data: fields })
          : await prisma.result.create({ data: { categoryId: dbCat.id, ...fields } });
        if (!found) { dbCat.results.push(saved); stats.results++; }
        if (key(r.id)) resultIds.set(r.id, saved.id);
      }

      for (const rw of localCat.rewards || []) {
        const rewardName = cleanText(rw?.name, 100);
        if (!rewardName || !isPositiveNumber(rw.cost)) { stats.skipped++; continue; }
        const found = pickExisting(dbCat.rewards, rw.id, (x) => x.name === rewardName);
        // Resolve links through the maps so they point at the rows just written.
        const linkedActionId = actionIds.get(rw.linkedActionId) ?? null;
        const linkedResultId = resultIds.get(rw.linkedResultId) ?? null;
        const fields = {
          name: rewardName,
          cost: rw.cost,
          thresholdType: isOneOf(rw.thresholdType, THRESHOLD_TYPES, "score"),
          period: isOneOf(rw.period, REWARD_PERIODS, "monthly"),
          linkedActionId,
          linkedResultId,
          linkedPercent: isPercent(rw.linkedPercent) ? rw.linkedPercent : 100,
          price: isNonNegativeNumber(rw.price) ? rw.price : null,
          claimed: !!rw.claimed,
          claimedAt: toDate(rw.claimedAt),
        };
        if (!found) {
          const saved = await prisma.reward.create({ data: { categoryId: dbCat.id, ...fields } });
          dbCat.rewards.push(saved);
          stats.rewards++;
        } else {
          await prisma.reward.update({ where: { id: found.id }, data: fields });
        }
      }
    }

    // Daily chart history. The client stores { year, month, dayOfMonth } and no
    // date, so the unique (userId, date) key is derived from those three parts in
    // UTC — deriving it locally would shift the day for negative UTC offsets.
    for (const l of Array.isArray(req.body.progressLogs) ? req.body.progressLogs : []) {
      const year = Number.parseInt(l?.year, 10);
      const month = Number.parseInt(l?.month, 10);
      const day = Number.parseInt(l?.dayOfMonth, 10);
      if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) { stats.skipped++; continue; }
      if (month < 1 || month > 12 || day < 1 || day > 31) { stats.skipped++; continue; }
      const date = new Date(Date.UTC(year, month - 1, day));
      if (Number.isNaN(date.getTime())) { stats.skipped++; continue; }
      await prisma.progressLog.upsert({
        where: { userId_date: { userId: req.user.id, date } },
        create: {
          userId: req.user.id,
          date,
          year,
          month,
          dayOfMonth: day,
          qualityScore: isNonNegativeNumber(l.qualityScore) ? l.qualityScore : 0,
          expectedScore: isNonNegativeNumber(l.expectedScore) ? l.expectedScore : 0,
          resultsScore: isNonNegativeNumber(l.resultsScore) ? l.resultsScore : null,
        },
        update: {
          dayOfMonth: day,
          qualityScore: isNonNegativeNumber(l.qualityScore) ? l.qualityScore : 0,
          expectedScore: isNonNegativeNumber(l.expectedScore) ? l.expectedScore : 0,
          resultsScore: isNonNegativeNumber(l.resultsScore) ? l.resultsScore : null,
        },
      });
      stats.progressLogs++;
    }

    // Past months, so the month picker's history survives the import too.
    // The client keeps this as an object keyed "YYYY-MM", not an array.
    const snapshots = req.body.monthlySnapshots;
    if (snapshots && typeof snapshots === "object" && !Array.isArray(snapshots)) {
      for (const [month, data] of Object.entries(snapshots)) {
        if (!isMonthKey(month) || !Array.isArray(data)) { stats.skipped++; continue; }
        await prisma.monthlySnapshot.upsert({
          where: { userId_month: { userId: req.user.id, month } },
          create: { userId: req.user.id, month, data },
          update: { data },
        });
        stats.snapshots++;
      }
    }

    // Imported logs are the user's real history, so don't let the recomputed
    // dashboard overwrite them for today. With no logs in the payload there is
    // nothing to protect and the normal refresh behaviour is correct.
    const hadLogs = Array.isArray(req.body.progressLogs) && req.body.progressLogs.length > 0;
    const dashboard = await recomputeAndLog(req.user.id, 0, new Date(), { persist: !hadLogs });
    return res.json({ ok: true, mode, imported: stats, dashboard });
  } catch (err) {
    next(err);
  }
});

export default router;
