import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    const where = { userId: req.user.id };
    if (!isNaN(month)) where.month = month;
    if (!isNaN(year)) where.year = year;

    const logs = await prisma.progressLog.findMany({
      where,
      orderBy: { date: "asc" },
    });
    return res.json({ logs });
  } catch (err) {
    next(err);
  }
});

router.get("/export", async (req, res, next) => {
  try {
    const format = req.query.format === "csv" ? "csv" : "json";
    const logs = await prisma.progressLog.findMany({
      where: { userId: req.user.id },
      orderBy: { date: "asc" },
    });

    if (format === "csv") {
      const header = "date,dayOfMonth,month,year,qualityScore,expectedScore";
      const rows = logs.map((l) =>
        `${l.date.toISOString().slice(0, 10)},${l.dayOfMonth},${l.month},${l.year},${l.qualityScore},${l.expectedScore}`
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=progress.csv");
      return res.send([header, ...rows].join("\n"));
    }

    return res.json({ logs });
  } catch (err) {
    next(err);
  }
});

export default router;
