const _now = new Date();
const _realMonthName = _now.toLocaleString("en-US", { month: "long" });
const _realTotalDays = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();

export const userData = {
  name: "User",
  // Derived from the real computer date so the UI always matches "today".
  month: _realMonthName,
  year: _now.getFullYear(),
  totalDays: _realTotalDays,
  daysPassed: _now.getDate(),
};

const TURQUOISE = "#6DF5E3";
const WHITE = "#ffffff";

// Mirrors server/src/seed/defaultCategories.js so guest mode shares the same
// auto-generated themed reward tiers from the Finance $ target.
const FINANCE_INCOME_TARGET = 1000;
const REVENUE_TIER_NAMES = [
  "Nice dinner out",
  "New outfit / sneakers",
  "Weekend getaway",
  "Big splurge",
];
const DAILY_THEMES = [
  { name: "Guilt-free treat today", period: "daily" },
  { name: "Extra hour of your favourite hobby", period: "daily" },
  { name: "Order in a meal — zero guilt", period: "daily" },
  { name: "30 min of screen-free wind-down tonight", period: "daily" },
];
const WEEKLY_THEMES = [
  { name: "Cinema / game night", period: "weekly" },
  { name: "New music / a book you've been eyeing", period: "weekly" },
  { name: "Sleep in on the weekend", period: "weekly" },
  { name: "Takeout + movie night, no chores", period: "weekly" },
];
const MONTHLY_SCORE_TIERS = [
  { min: 40, name: "Takeout night, no cooking" },
  { min: 60, name: "Nice dinner out" },
  { min: 80, name: "New outfit / sneakers" },
  { min: 95, name: "Weekend getaway" },
  { min: 100, name: "Full day off — you earned it" },
];
export function generateRewardTiers(financeTarget = FINANCE_INCOME_TARGET) {
  const tiers = DAILY_THEMES.map((t) => ({
    name: t.name, cost: 0, thresholdType: "daily", period: t.period,
  }));
  tiers.push(
    ...WEEKLY_THEMES.map((t) => ({
      name: t.name, cost: 0, thresholdType: "weekly", period: t.period,
    }))
  );
  if (Number.isFinite(financeTarget) && financeTarget > 0) {
    const fractions = [0.25, 0.5, 0.75, 1];
    fractions.forEach((f, i) => {
      const cost = Math.max(10, Math.round((financeTarget * f) / 10) * 10);
      tiers.push({
        name: REVENUE_TIER_NAMES[i] || `Reward ${i + 1}`,
        cost,
        threshold: cost,
        thresholdType: "revenue",
        period: "monthly",
      });
    });
  }
  MONTHLY_SCORE_TIERS.forEach((t) => {
    tiers.push({ name: t.name, cost: t.min, threshold: t.min, thresholdType: "score", period: "monthly" });
  });
  return tiers;
}


export const categories = [
  {
    id: "finance",
    name: "Finance",
    color: TURQUOISE,
    actions: [],
    results: [
      { label: "Money earned", current: 240, target: 1000, unit: "$" },
    ],
  },
  {
    id: "business",
    name: "Business & Career",
    color: WHITE,
    actions: [
      { label: "Deep work sessions", weight: 40, current: 0, target: 20, unit: " sessions" },
      { label: "Talk to potential clients/employers", weight: 30, current: 0, target: 10, unit: "" },
      { label: "Ship one project or offer", weight: 30, current: 0, target: 1, unit: "" },
    ],
    results: [
      { label: "New clients/opportunities won", current: 1, target: 3, unit: "" },
      { label: "Business revenue", current: 90, target: 500, unit: "$" },
    ],
  },
  {
    id: "faith",
    name: "Faith & Religion",
    color: TURQUOISE,
    actions: [
      { label: "Days with all prayers on time", weight: 40, current: 0, target: 28, unit: "" },
      { label: "Quran/scripture pages", weight: 30, current: 0, target: 60, unit: " pages" },
      { label: "Charity given", weight: 20, current: 0, target: 4, unit: " times" },
      { label: "Voluntary fasts", weight: 10, current: 0, target: 3, unit: "" },
    ],
    results: [],
  },
  {
    id: "health",
    name: "Health & Fitness",
    color: WHITE,
    actions: [
      { label: "Workout sessions", weight: 30, current: 0, target: 12, unit: " sessions" },
      { label: "Running total", weight: 30, current: 0, target: 50, unit: " km" },
      { label: "Days without junk food", weight: 25, current: 0, target: 20, unit: " days" },
      { label: "Workout consistency", weight: 15, current: 0, target: 10, unit: "" },
    ],
    results: [
      { label: "Weight", current: 79, target: 72, unit: " kg", invert: true },
    ],
  },
  {
    id: "learning",
    name: "Learning",
    color: TURQUOISE,
    actions: [
      { label: "Books finished", weight: 30, current: 0, target: 2, unit: "" },
      { label: "Learning hours (courses/tutorials)", weight: 30, current: 0, target: 40, unit: " hrs" },
      { label: "Complete one course/certification", weight: 40, current: 0, target: 1, unit: "" },
    ],
    results: [
      { label: "New skill applied in a real project", current: 0, target: 1, unit: "", isBadge: true },
    ],
  },
  {
    id: "social",
    name: "Social Media Presence",
    color: WHITE,
    actions: [
      { label: "Content pieces posted", weight: 40, current: 0, target: 15, unit: "" },
      { label: "Engagement sessions", weight: 30, current: 0, target: 20, unit: "" },
      { label: "Study top creators in your niche", weight: 15, current: 0, target: 8, unit: "" },
      { label: "Posting consistency", weight: 15, current: 0, target: 12, unit: "" },
    ],
    results: [
      { label: "Followers gained", current: 12, target: 100, unit: "" },
      { label: "Total views", current: 450, target: 5000, unit: "" },
    ],
  },
  {
    id: "family",
    name: "Family & Social",
    color: TURQUOISE,
    actions: [
      { label: "Quality time with parents/family", weight: 40, current: 0, target: 10, unit: " times" },
      { label: "Calls/check-ins with loved ones", weight: 30, current: 0, target: 12, unit: " calls" },
      { label: "Meaningful meetups with friends", weight: 15, current: 0, target: 6, unit: "" },
      { label: "Help family with something", weight: 15, current: 0, target: 5, unit: "" },
    ],
    results: [],
  },
  {
    id: "discipline",
    name: "Discipline & Mind",
    color: WHITE,
    actions: [
      { label: "Days waking up before 7am", weight: 15, current: 0, target: 20, unit: " days" },
      { label: "Mornings without phone first hour", weight: 15, current: 0, target: 18, unit: " days" },
      { label: "Journaling entries", weight: 10, current: 0, target: 15, unit: "" },
      { label: "Focus sessions", weight: 15, current: 0, target: 20, unit: "" },
      { label: "Daily fundamentals done (3 non-negotiables)", weight: 25, current: 0, target: 1, unit: "", resetType: "daily" },
      { label: "Weekly review & plan", weight: 20, current: 0, target: 1, unit: "", resetType: "weekly" },
    ],
    results: [
      { label: "Average daily screen time", current: 6, target: 2, unit: " hrs", invert: true },
    ],
  },
  {
    id: "rewards",
    name: "Rewards",
    color: TURQUOISE,
    actions: [],
    results: [],
    isRewards: true,
    rewards: generateRewardTiers(),
  },
];

export const siteLinks = [
  { label: "Main Site", href: "#" },
  { label: "Admin", href: "#" },
];
