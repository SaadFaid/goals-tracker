import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { calculateDashboardState } from "../lib/calc.js";
import { requireAuth } from "../middleware/auth.js";

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
export async function recomputeAndLog(userId, monthOffset = 0, date = new Date()) {
  const dashboard = await loadDashboardForDate(userId, date, monthOffset);

  const targetDate = new Date(date);
  targetDate.setMonth(targetDate.getMonth() + monthOffset);
  const d = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));

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
    },
    update: {
      dayOfMonth: dashboard.meta.dayOfMonth,
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
      qualityScore: dashboard.stats.qualityPercent,
      expectedScore: dashboard.stats.expectedPercent,
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

export default router;
