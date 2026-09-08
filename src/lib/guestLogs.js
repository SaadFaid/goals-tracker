import { calculateDashboardState } from "./score";
import { userData } from "../data/goals";

/**
 * Guest mode has no server-side ProgressLogs, so we synthesize a realistic
 * year-long per-day history so the date-popup history shows a whole year.
 * Each entry mirrors the ProgressLog shape:
 *   { dayOfMonth, month, year, qualityScore, expectedScore }
 */

// Deterministic pseudo-random so the demo doesn't change every render.
function seeded(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

// How many days get logged each month, as we "get better" over the year.
const DAYS_BY_AGE = [12, 14, 16, 18, 20, 22, 24, 25, 26, 27, 28, 29];

// Baseline quality by how far back the month is (delta = months ago).
// Recent months score higher — we've been getting better over the year.
function baseQuality(delta) {
  return 80 - delta * 2.4; // ~78% a month ago -> ~54% a year ago
}

export function generateGuestLogs(categories) {
  const now = new Date();
  const daysPassed = Math.max(1, Math.min(userData.daysPassed, userData.totalDays));
  const logs = [];

  // Current month: derive daily quality from the dashboard's cumulative series.
  const dash = calculateDashboardState(categories, now, 0);
  const cumulative = dash?.chartData?.cumulative || [];
  const qualityTarget = Math.max(50, dash?.stats?.qualityPercent ?? 55);
  for (let d = 1; d <= daysPassed; d++) {
    const found = cumulative.find((c) => c.day === d);
    const value = found ? found.value : Math.round((d / daysPassed) * qualityTarget);
    logs.push({
      dayOfMonth: d,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      qualityScore: Math.round(value * 10) / 10,
      expectedScore: Math.round((d / userData.totalDays) * 100 * 10) / 10,
    });
  }

  // 11 past months (older -> newer), year-round demo history.
  for (let delta = 1; delta <= 11; delta++) {
    const target = new Date(now.getFullYear(), now.getMonth() - delta, 1);
    const month = target.getMonth() + 1;
    const year = target.getFullYear();
    const daysInMonth = new Date(year, month, 0).getDate();
    const rand = seeded(1000 + delta * 7919);

    // Number of logged days this month (grows as we get more consistent).
    const count = Math.min(daysInMonth, DAYS_BY_AGE[11 - delta]);
    const chosen = new Set();
    while (chosen.size < count) chosen.add(1 + Math.floor(rand() * daysInMonth));
    const days = [...chosen].sort((a, b) => a - b);

    const base = baseQuality(delta);
    for (const d of days) {
      const wave = Math.sin((d / daysInMonth) * Math.PI) * 6; // up through the month
      const jitter = (rand() - 0.5) * 10;
      const q = Math.round(Math.max(8, Math.min(96, base + wave + jitter)));
      logs.push({
        dayOfMonth: d,
        month,
        year,
        qualityScore: q,
        expectedScore: Math.round((d / daysInMonth) * 100 * 10) / 10,
      });
    }
  }

  return logs;
}
