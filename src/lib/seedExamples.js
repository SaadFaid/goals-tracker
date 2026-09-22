// Deterministic example data so the Days history and Plan views have something
// to look at. Seeded once per identity (guest or account) on first use, then
// real usage takes over. All dates are local-time YYYY-MM-DD.

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `seed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const pad2 = (n) => String(n).padStart(2, "0");
const dk = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

// Example daily-checklist tasks (id assigned at seed time).
const TASK_POOL = [
  "Read 20 pages",
  "Workout — push day",
  "Draft the plan for the week",
  "Client follow-up email",
  "Study 1 hour",
  "Clean desk & inbox",
  "Walk 30 minutes",
  "Practice 25 minutes",
  "Write in journal",
  "Prep meals for tomorrow",
];

// Build a deterministic set of saved days for the last N months (including a
// few days in the current month, and last month, before today).
export function makeExampleDays({ months = 3 } = {}) {
  const now = new Date();
  const out = {};

  for (let m = 0; m < months; m++) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = base.getFullYear();
    const month = base.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    // Choose day offsets deterministically (spread across the month).
    const offsets = m === 0 ? [1, 4, 7, 10, 13, 17, 21, 24, 27] : [2, 5, 9, 12, 16, 20, 23, 26, 28];

    for (const dayOffset of offsets) {
      const day = dayOffset;
      if (day > daysInMonth) continue;
      // Skip future days (current month only).
      const candidate = new Date(year, month - 1, day);
      if (candidate > now) continue;

      // Deterministic task selection for this day.
      const start = (year + month + day) % TASK_POOL.length;
      const count = 2 + ((year + month * 2 + day) % 3); // 2..4 tasks
      const tasks = [];
      for (let i = 0; i < count; i++) {
        const text = TASK_POOL[(start + i * 3) % TASK_POOL.length];
        const done = ((year * month + day + i * 2) % 5) < 3; // roughly 3 done / 2 not
        tasks.push({ id: uid(), text, done });
      }
      out[dk(year, month, day)] = tasks;
    }
  }

  return out;
}

// Example schedule rows for the Plan view, spread across the last months.
// Each row matches the usePlanStore.addSlot shape with repeat "today".
export function makeExamplePlanRows({ months = 3 } = {}) {
  const now = new Date();
  const rows = [];

  const SAMPLE = [
    { label: "Deep work block", catName: "Focus", color: "#6DF5E3", start: "09:00", end: "10:30" },
    { label: "Gym", catName: "Health", color: "#4BE376", start: "18:00", end: "19:00" },
    { label: "Arabic lesson", catName: "Study", color: "#FFB86C", start: "20:00", end: "20:45" },
    { label: "Read", catName: "Personal", color: "#C39BFF", start: "22:00", end: "22:30" },
    { label: "Groceries", catName: "Errands", color: "#F38BA8", start: "17:00", end: "17:30" },
    { label: "Weekend walk", catName: "Health", color: "#A7F070", start: "07:30", end: "08:15" },
  ];

  for (let m = 0; m < months; m++) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = base.getFullYear();
    const month = base.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const dayOffsets = m === 0 ? [1, 5, 9, 13, 17, 21, 25] : [2, 6, 10, 14, 18, 22, 26];

    for (const dayOffset of dayOffsets) {
      if (dayOffset > daysInMonth) continue;
      const candidate = new Date(year, month - 1, dayOffset);
      if (candidate > now) continue;

      // 1-2 rows per that day (deterministic which samples).
      const rowStart = (year + month + dayOffset) % SAMPLE.length;
      const rowCount = 1 + ((year + month * 3 + dayOffset) % 2);
      for (let i = 0; i < rowCount; i++) {
        const s = SAMPLE[(rowStart + i * 2) % SAMPLE.length];
        rows.push({
          id: uid(),
          catId: `seed-${s.catName}`,
          type: "action",
          idx: i,
          label: s.label,
          catName: s.catName,
          color: s.color,
          note: "",
          date: dk(year, month, dayOffset),
          start: s.start,
          end: s.end,
          repeat: "today",
          repeatDay: [],
        });
      }
    }
  }

  return rows;
}