import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { cleanText } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

const DEFAULTS = {
  workM: 25, breakM: 5, soundId: "chime", phase: "focus", pomodoros: 0,
  repeat: true, mode: "focus", fRunning: false, fEndAt: null, fHold: 0,
  tH: 0, tM: 0, tS: 0, tRunning: false, tEndAt: null, tHold: 0,
};

const PHASES = ["focus", "break"];
const MODES = ["focus", "timer"];
const clamp = (v, min, max, fallback) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : fallback;
const toStamp = (v) => {
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const shape = (row) => (row ? {
  workM: row.workM, breakM: row.breakM, soundId: row.soundId, phase: row.phase,
  pomodoros: row.pomodoros, repeat: row.repeat, mode: row.mode,
  fRunning: row.fRunning, fEndAt: row.fEndAt?.toISOString() ?? null, fHold: row.fHold,
  tH: row.tH, tM: row.tM, tS: row.tS,
  tRunning: row.tRunning, tEndAt: row.tEndAt?.toISOString() ?? null, tHold: row.tHold,
} : { ...DEFAULTS });

/** Defaults until the account saves something, so a new account is never null. */
router.get("/", async (req, res, next) => {
  try {
    const row = await prisma.pomodoroSettings.findUnique({ where: { userId: req.user.id } });
    return res.json({ settings: shape(row) });
  } catch (err) {
    next(err);
  }
});

/** Upsert this account's pomodoro state, including a running timer's deadline. */
router.put("/", async (req, res, next) => {
  try {
    const { id: userId } = req.user;  // req.user is { id, email }
    const b = req.body?.settings ?? req.body ?? {};
    const data = {
      workM: clamp(b.workM, 1, 240, DEFAULTS.workM),
      breakM: clamp(b.breakM, 1, 120, DEFAULTS.breakM),
      soundId: cleanText(b.soundId, 50) || DEFAULTS.soundId,
      phase: PHASES.includes(b.phase) ? b.phase : DEFAULTS.phase,
      pomodoros: clamp(b.pomodoros, 0, 9999, DEFAULTS.pomodoros),
      repeat: typeof b.repeat === "boolean" ? b.repeat : DEFAULTS.repeat,
      mode: MODES.includes(b.mode) ? b.mode : DEFAULTS.mode,
      fRunning: !!b.fRunning,
      fEndAt: toStamp(b.fEndAt),
      fHold: clamp(b.fHold, 0, 24 * 60 * 60, DEFAULTS.fHold),
      tH: clamp(b.tH, 0, 999, DEFAULTS.tH),
      tM: clamp(b.tM, 0, 59, DEFAULTS.tM),
      tS: clamp(b.tS, 0, 59, DEFAULTS.tS),
      tRunning: !!b.tRunning,
      tEndAt: toStamp(b.tEndAt),
      tHold: clamp(b.tHold, 0, 24 * 60 * 60, DEFAULTS.tHold),
    };
    const row = await prisma.pomodoroSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return res.json({ settings: shape(row) });
  } catch (err) {
    next(err);
  }
});

router.delete("/", async (req, res, next) => {
  try {
    await prisma.pomodoroSettings.deleteMany({ where: { userId: req.user.id } });
    return res.json({ settings: { ...DEFAULTS } });
  } catch (err) {
    next(err);
  }
});

export default router;
