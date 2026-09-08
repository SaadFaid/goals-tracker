import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { seedUserCategories } from "../seed/defaultCategories.js";
import { calculateDashboardState } from "../lib/calc.js";
import {
  cleanText,
  isEmail,
  isStrongPassword,
  assert,
  createHttpError,
} from "../validation/validate.js";

const router = Router();

async function loadDashboard(userId) {
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    include: { actions: { orderBy: { sortOrder: "asc" } }, results: { orderBy: { sortOrder: "asc" } }, rewards: true },
  });
  return calculateDashboardState(categories, new Date(), 0);
}

function serializeUser(user) {
  return { id: user.id, email: user.email, name: user.name, timezone: user.timezone, monthOffset: user.monthOffset };
}

router.post("/register", async (req, res, next) => {
  try {
    const email = cleanText(req.body.email, 100).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const name = cleanText(req.body.name, 100) || "User";

    assert(isEmail(email), 400, "Invalid email address");
    assert(isStrongPassword(password), 400, "Password must be ≥8 chars with uppercase, number, and symbol");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw createHttpError(409, "Email already registered");

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    await seedUserCategories(prisma, user.id);

    const accessToken = signAccessToken(user);
    const { token: refreshToken, expiresAt } = await issueRefreshToken(user.id);
    setRefreshCookie(res, refreshToken, expiresAt);

    const dashboard = await loadDashboard(user.id);

    return res.status(201).json({
      accessToken,
      user: serializeUser(user),
      dashboard,
      isGuest: false,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = cleanText(req.body.email, 100).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw createHttpError(401, "Invalid credentials");
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw createHttpError(401, "Invalid credentials");

    const accessToken = signAccessToken(user);
    const { token: refreshToken, expiresAt } = await issueRefreshToken(user.id);
    setRefreshCookie(res, refreshToken, expiresAt);

    const dashboard = await loadDashboard(user.id);

    return res.json({
      accessToken,
      user: serializeUser(user),
      dashboard,
      isGuest: false,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const oldToken = req.cookies?.refreshToken;
    if (!oldToken) throw createHttpError(401, "No refresh token");
    const rotated = await rotateRefreshToken(oldToken);
    if (!rotated) throw createHttpError(401, "Invalid or expired refresh token");

    const { user, token, expiresAt } = rotated;
    setRefreshCookie(res, token, expiresAt);
    const accessToken = signAccessToken(user);
    const dashboard = await loadDashboard(user.id);

    return res.json({
      accessToken,
      user: serializeUser(user),
      dashboard,
      isGuest: false,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const email = cleanText(req.body.email, 100).toLowerCase();
    assert(isEmail(email), 400, "Invalid email address");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Do not reveal whether the account exists.
      return res.json({ ok: true });
    }

    const raw = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    // No email service configured: return the raw token so the UI can show it.
    return res.json({ ok: true, resetToken: raw });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const raw = typeof req.body.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    assert(raw, 400, "Reset token is required");
    assert(isStrongPassword(password), 400, "Password must be ≥8 chars with uppercase, number, and symbol");

    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    assert(record, 400, "Invalid or expired reset token");
    if (record.usedAt) throw createHttpError(400, "Reset token already used");
    if (record.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } });
      throw createHttpError(400, "Reset token expired");
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    // Invalidate all existing sessions for security.
    await prisma.refreshToken.deleteMany({ where: { userId: record.userId } });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const oldToken = req.cookies?.refreshToken;
    if (oldToken) {
      await prisma.refreshToken.deleteMany({ where: { token: oldToken, userId: req.user.id } });
    }
    clearRefreshCookie(res);
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw createHttpError(404, "User not found");
    return res.json({ user: serializeUser(user), isGuest: false });
  } catch (err) {
    next(err);
  }
});

export default router;
