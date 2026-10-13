/**
 * Guest mode has no server-side ProgressLogs, so we synthesize a deterministic
 * history: the PAST months so the date-popup history shows a whole year, plus
 * the CURRENT month up to yesterday so the current-month chart line is
 * populated (the demo account should not read as all-zeros).
 *
 * Only PAST days are frozen here. Today's entry is written live by the store
 * (ensureDailyLog), so today always reflects the real seeded progress while
 * every earlier day stays put. Each entry mirrors the ProgressLog shape:
 *   { dayOfMonth, month, year, qualityScore, expectedScore, resultsScore }
 */

// Deterministic pseudo-random so the demo doesn't change between runs.
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

export function generateGuestLogs() {
  const now = new Date();
  const logs = [];

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
        resultsScore: Math.round(Math.max(0, Math.min(100, q + 4)) * 10) / 10,
      });
    }
  }

  // Current month, days 1..yesterday: a smooth ramp that lines up with the
  // seeded progress, so the live month's chart is not empty. Today is left for
  // the store to write (and keep writing) — these days never change again.
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = now.getDate();
  const rand = seeded(4242 + y * 100 + m);
  for (let d = 1; d < today; d++) {
    const wave = Math.sin((d / daysInMonth) * Math.PI) * 5;
    const jitter = (rand() - 0.5) * 8;
    const q = Math.round(Math.max(12, Math.min(96, 68 + wave + jitter)));
    logs.push({
      dayOfMonth: d,
      month: m,
      year: y,
      qualityScore: q,
      expectedScore: Math.round((d / daysInMonth) * 100 * 10) / 10,
      resultsScore: Math.round(Math.max(0, Math.min(100, 58 + wave + jitter)) * 10) / 10,
    });
  }

  return logs;
}