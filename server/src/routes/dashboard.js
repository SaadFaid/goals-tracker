import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { aggregateResultsPct, calculateDashboardState } from "../lib/calc.js";
import { requireAuth } from "../middleware/auth.js";
import { createHttpError } from "../validation/validate.js";

const router = Router();

async function loadDashboardForDate(userId, date, monthOffset = 0) {
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    include: {
      actions: { orderBy: { sortOrder: "asc" } },
      results: { orderBy: { sortOrder: "asc" } },
      rewards: true,
    },
  });
  return calculateDashboardState(categories, date, monthOffset);
}

/** Recompute + upsert today's ProgressLog. Returns dashboard + log. */
export async function recomputeAndLog(userId, monthOffset = 0, date = new Date(), { persist = true } = {}) {
  const dashboard = await loadDashboardForDate(userId, date, monthOffset);

  // persist:false returns the same dashboard without touching the daily log. The
  // sync route uses it when the payload carried its own progressLogs, so a
  // recomputed score cannot overwrite the values that were just imported.
  if (!persist) return dashboard;

  const targetDate = new Date(date);
  targetDate.setMonth(targetDate.getMonth() + monthOffset);
  const d = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
  const resultsScore = Math.round(aggregateResultsPct(dashboard.categories) * 10) / 10;

  await prisma.progressLog.upsert({
    where: { userId_date: { userId, date: d } },
    create: {
      userId,
      date: d,
      dayOfMonth: dashboard.meta.dayOfMonth,
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
      qualityScore: dashboard.stats.qualityPercent,
      expectedScore: dashboard.stats.expectedPercent,
      resultsScore,
    },
    update: {
      dayOfMonth: dashboard.meta.dayOfMonth,
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
      qualityScore: dashboard.stats.qualityPercent,
      expectedScore: dashboard.stats.expectedPercent,
      resultsScore,
    },
  });

  return dashboard;
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { monthOffset: true } });
    const monthOffset = user?.monthOffset || 0;
    const dashboard = await loadDashboardForDate(req.user.id, date, monthOffset);
    return res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

// Month rollover, done as ONE transaction so a month is never left half-cleared
// — the client used to send a reset per row, and a single rejected row stopped
// the queue and left the rest of the month sitting at last month's numbers.
// `from` is the month the live data belongs to (the client's local calendar),
// `to` is the new live month. The finished month is archived first, counters
// and claims are cleared, and the fresh month is snapshotted and returned.
router.post("/rollover", async (req, res, next) => {
  try {
    const from = String(req.body?.from || "");
    const to = String(req.body?.to || "");
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
      throw createHttpError(400, "from and to must be YYYY-MM");
    }
    if (from >= to) throw createHttpError(400, "from must be an earlier month than to");

    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { monthOffset: true } });
    const monthOffset = user?.monthOffset || 0;

    // Idempotency guard. A client whose stored lastMonthKey fell behind (or a
    // rollover response that never reached it) replays this route on every
    // boot, and re-running the reset would wipe progress made in the month the
    // user is actively using. Once the target month has its own progress log it
    // is already live, so a rollover is no longer meaningful: hand back the
    // current dashboard untouched instead of clearing it. Biased deliberately
    // toward keeping data — a stuck counter is recoverable, a cleared month is
    // not.
    const [toYear, toMonth] = to.split("-").map(Number);
    const alreadyLive = await prisma.progressLog.findFirst({
      where: { userId, year: toYear, month: toMonth },
      select: { id: true },
    });
    if (alreadyLive) {
      const dashboard = await loadDashboardForDate(userId, new Date(), monthOffset);
      return res.json(dashboard);
    }

    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
      include: {
        actions: { orderBy: { sortOrder: "asc" } },
        results: { orderBy: { sortOrder: "asc" } },
        rewards: true,
      },
    });
    const categoryIds = categories.map((c) => c.id);

    // Archive the finished month as it stands, but never overwrite an existing
    // snapshot: one written while that month was live is already the finished
    // data, and a retry after a partial failure must not bury it under a
    // half-reset month.
    const archived = calculateDashboardState(categories, new Date(), monthOffset).categories;
    const existing = await prisma.monthlySnapshot.findUnique({
      where: { userId_month: { userId, month: from } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.monthlySnapshot.create({ data: { userId, month: from, data: archived } });
    }

    await prisma.$transaction([
      prisma.action.updateMany({ where: { categoryId: { in: categoryIds } }, data: { current: 0 } }),
      prisma.result.updateMany({ where: { categoryId: { in: categoryIds } }, data: { current: 0 } }),
      prisma.reward.updateMany({
        where: { categoryId: { in: categoryIds } },
        data: { claimed: false, claimedAt: null },
      }),
    ]);

    const dashboard = await loadDashboardForDate(userId, new Date(), monthOffset);
    await prisma.monthlySnapshot.upsert({
      where: { userId_month: { userId, month: to } },
      create: { userId, month: to, data: dashboard.categories },
      update: { data: dashboard.categories },
    });
    return res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

export default router;
