// The streak, in one place so the header, the leaderboard and the settings
// panel can never disagree.
//
// A day counts when you moved any goal on it. The rule the product promises:
// miss three days in a row and the streak ends. So a gap of 0, 1 or 2 days
// since the last active day keeps the flame; a gap of 3 ends it.

export const dayKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const atMidnight = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const DAYS_TO_BREAK = 3;

/**
 * @param {Record<string, boolean>} activityDays map of "YYYY-MM-DD" → true
 * @param {Date} now
 * @returns {{ streak: number, gap: number|null, lastActive: string|null, atRisk: boolean }}
 */
export function computeStreak(activityDays, now = new Date()) {
  const days = new Set(
    Object.keys(activityDays || {}).filter((k) => activityDays[k])
  );
  if (days.size === 0) return { streak: 0, gap: null, lastActive: null, atRisk: false };

  const today = atMidnight(now);

  // Walk back to the most recent active day. 400 days is generous enough for
  // any real streak, and bounds the loop if the map is somehow absurd.
  let last = null;
  const probe = new Date(today);
  for (let i = 0; i <= 400; i += 1) {
    if (days.has(dayKey(probe))) {
      last = new Date(probe);
      break;
    }
    probe.setDate(probe.getDate() - 1);
  }
  if (!last) return { streak: 0, gap: null, lastActive: null, atRisk: false };

  const gap = Math.round((today - last) / 86400000);
  if (gap >= DAYS_TO_BREAK) {
    return { streak: 0, gap, lastActive: dayKey(last), atRisk: false };
  }

  let streak = 0;
  const back = new Date(last);
  while (days.has(dayKey(back))) {
    streak += 1;
    back.setDate(back.getDate() - 1);
  }

  return {
    streak,
    gap,
    lastActive: dayKey(last),
    // One quiet day left before it ends — worth a nudge, not an alarm.
    atRisk: gap === DAYS_TO_BREAK - 1,
  };
}

/** "5-day streak" / "No streak yet" */
export function streakLabel(streak) {
  if (!streak) return "No streak yet";
  return `${streak}-day streak`;
}
