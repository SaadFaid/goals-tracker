import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { createHttpError } from "../validation/validate.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw createHttpError(401, "Unauthorized: missing token");
    }
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (!payload.userId) {
      throw createHttpError(401, "Unauthorized");
    }
    req.user = { id: payload.userId, email: payload.email };
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Unauthorized: invalid or expired token" });
    }
    next(err);
  }
}

/** Verify a resource belongs to a category owned by the current user. */
export async function assertCategoryOwned(categoryId, userId) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!category) throw createHttpError(404, "Category not found");
  return category;
}

/** Verify a resource (action/result/reward) exists and is owned by the user. */
export async function assertOwned(model, resourceId, userId) {
  const row = await prisma[model].findFirst({
    where: { id: resourceId },
    include: { category: true },
  });
  if (!row || row.category.userId !== userId) {
    throw createHttpError(404, `${model} not found`);
  }
  return row;
}
