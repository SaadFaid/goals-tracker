import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./prisma.js";

const BCRYPT_ROUNDS = 10;

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || "15m" }
  );
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export async function issueRefreshToken(userId) {
  const token = generateRefreshToken();
  const expiresInDays = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "7", 10);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });

  return { token, expiresAt };
}

export async function rotateRefreshToken(oldToken) {
  // Find and delete the old token atomically-ish
  const found = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: true },
  });
  if (!found) return null;
  if (found.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: found.id } });
    return null;
  }
  await prisma.refreshToken.delete({ where: { id: found.id } });
  const next = await issueRefreshToken(found.userId);
  return { user: found.user, ...next };
}

export function setRefreshCookie(res, token, expiresAt) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
  });
}
