import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { createHttpError } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

// List of months that have a saved snapshot (for the month-picker green dots).
router.get("/", async (req, res, next) => {
  try {
    const snaps = await prisma.monthlySnapshot.findMany({
      where: { userId: req.user.id },
      select: { month: true },
    });
    return res.json({ months: snaps.map((s) => s.month) });
  } catch (err) {
    next(err);
  }
});

// Load a single month's snapshot. 404 → client renders empty state.
router.get("/:month", async (req, res, next) => {
  try {
    const month = String(req.params.month || "");
    if (!/^\d{4}-\d{2}$/.test(month)) throw createHttpError(400, "Invalid month");
    const snap = await prisma.monthlySnapshot.findUnique({
      where: { userId_month: { userId: req.user.id, month } },
    });
    if (!snap) throw createHttpError(404, "No snapshot for this month");
    return res.json({ month, data: snap.data });
  } catch (err) {
    next(err);
  }
});

// Save a full month snapshot (the user's category graph for that month).
// Always scoped to the authenticated user — never trust a client user_id.
router.put("/:month", async (req, res, next) => {
  try {
    const month = String(req.params.month || "");
    if (!/^\d{4}-\d{2}$/.test(month)) throw createHttpError(400, "Invalid month");
    const data = req.body?.data;
    if (!Array.isArray(data)) throw createHttpError(400, "Snapshot data must be an array");

    const snap = await prisma.monthlySnapshot.upsert({
      where: { userId_month: { userId: req.user.id, month } },
      create: { userId: req.user.id, month, data },
      update: { data },
    });

    return res.json({ month, data: snap.data, savedAt: snap.updatedAt });
  } catch (err) {
    next(err);
  }
});

export default router;
