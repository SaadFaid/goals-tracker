import sanitizeHtml from "sanitize-html";

export function cleanText(value, maxLen = 100) {
  if (typeof value !== "string") return "";
  const cleaned = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .trim()
    .slice(0, maxLen);
  return cleaned;
}

export function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isStrongPassword(value) {
  if (typeof value !== "string" || value.length < 8) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!/[^A-Za-z0-9]/.test(value)) return false;
  return true;
}

export function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isWeight(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

export const DOT_COLORS = [
  "turquoise", "white", "pink", "purple", "blue", "orange", "green",
  "red", "grey", "black", "yellow",
  "indigo", "violet", "gold", "pinkwhite", "silver", "copper", "rosegold",
];

export function isDotColor(value) {
  return DOT_COLORS.includes(value);
}

export const RESET_TYPES = ["none", "daily", "weekly", "monthly"];
export const ACTION_TYPES = ["check", "amount", "count"];
export const THRESHOLD_TYPES = ["score", "revenue", "daily", "weekly", "action", "result"];
export const REWARD_PERIODS = ["daily", "weekly", "monthly"];

export function isOneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function isPercent(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function isMonthKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export function assert(condition, status, message) {
  if (!condition) {
    const err = new Error(message);
    err.status = status;
    throw err;
  }
}

export function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
