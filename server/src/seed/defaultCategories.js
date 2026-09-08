// Default 9 categories seeded for every new user (mirrors prompt §13).

// Finance "money earned" target drives the auto-generated revenue reward tiers.
const FINANCE_INCOME_TARGET = 1000;

const REVENUE_TIER_NAMES = [
  "Nice dinner out",
  "New outfit / sneakers",
  "Weekend getaway",
  "Big splurge",
];

// Themed, auto-generated rewards — one set per goal period. Daily/weekly
// rewards unlock by completing that period's actions; monthly by score.
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

// Monthly rewards escalate with the overall execution score.
const MONTHLY_SCORE_TIERS = [
  { min: 40, name: "Takeout night, no cooking" },
  { min: 60, name: "Nice dinner out" },
  { min: 80, name: "New outfit / sneakers" },
  { min: 95, name: "Weekend getaway" },
  { min: 100, name: "Full day off — you earned it" },
];

function dailyRewards() {
  return DAILY_THEMES.map((t) => ({
    name: t.name,
    cost: 0,
    thresholdType: "daily",
    period: t.period,
  }));
}

function weeklyRewards() {
  return WEEKLY_THEMES.map((t) => ({
    name: t.name,
    cost: 0,
    thresholdType: "weekly",
    period: t.period,
  }));
}

function monthlyRewards(financeTarget) {
  const tiers = [];
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

// Auto-generate all themed reward tiers from real targets instead of a
// hardcoded dump. Each tier carries its goal period so the UI can group them.
export function generateRewardTiers(financeTarget = FINANCE_INCOME_TARGET) {
  return [...dailyRewards(), ...weeklyRewards(), ...monthlyRewards(financeTarget)];
}

export const DEFAULT_CATEGORIES = [
  {
    name: "Finance",
    dotColor: "turquoise",
    actions: [],
    results: [{ label: "Money earned", current: 240, target: 1000, unit: "$" }],
    rewards: [],
  },
  {
    name: "Business & Career",
    dotColor: "white",
    actions: [
      { label: "Deep work sessions", weight: 40, current: 0, target: 20, unit: "sessions" },
      { label: "Talk to potential clients / employers", weight: 30, current: 0, target: 10, unit: "" },
      { label: "Ship one project or offer", weight: 30, current: 0, target: 1, unit: "" },
    ],
    results: [
      { label: "New clients / opportunities won", current: 1, target: 3, unit: "" },
      { label: "Business revenue", current: 90, target: 500, unit: "$" },
    ],
    rewards: [],
  },
  {
    name: "Faith & Religion",
    dotColor: "turquoise",
    actions: [
      { label: "Days with all prayers on time", weight: 40, current: 0, target: 31, unit: "" },
      { label: "Quran / scripture pages", weight: 30, current: 0, target: 100, unit: "" },
      { label: "Charity given", weight: 20, current: 0, target: 100, unit: "$" },
      { label: "Voluntary fasts", weight: 10, current: 0, target: 5, unit: "" },
    ],
    results: [],
    rewards: [],
  },
  {
    name: "Health & Fitness",
    dotColor: "white",
    actions: [
      { label: "Workout sessions", weight: 30, current: 0, target: 12, unit: "" },
      { label: "Running total", weight: 30, current: 0, target: 50, unit: "km" },
      { label: "Days without junk food", weight: 25, current: 0, target: 20, unit: "" },
      { label: "Stretching / mobility", weight: 15, current: 0, target: 15, unit: "" },
    ],
    results: [{ label: "Weight", current: 79.0, target: 72.0, unit: "kg" }],
    rewards: [],
  },
  {
    name: "Learning",
    dotColor: "turquoise",
    actions: [
      { label: "Books finished", weight: 30, current: 0, target: 2, unit: "" },
      { label: "Learning hours (courses / tutorials)", weight: 30, current: 0, target: 20, unit: "" },
      { label: "Complete one course / certification", weight: 40, current: 0, target: 1, unit: "" },
    ],
    results: [{ label: "New skill applied in a real project", current: 0, target: 1, unit: "" }],
    rewards: [],
  },
  {
    name: "Social Media Presence",
    dotColor: "white",
    actions: [
      { label: "Content pieces posted", weight: 40, current: 0, target: 8, unit: "" },
      { label: "Engagement sessions", weight: 30, current: 0, target: 15, unit: "" },
      { label: "Study top creators in your niche", weight: 15, current: 0, target: 5, unit: "" },
      { label: "Respond to comments / DMs", weight: 15, current: 0, target: 20, unit: "" },
    ],
    results: [
      { label: "Followers gained", current: 60, target: 500, unit: "" },
      { label: "Total views", current: 900, target: 10000, unit: "" },
    ],
    rewards: [],
  },
  {
    name: "Family & Social",
    dotColor: "turquoise",
    actions: [
      { label: "Quality time with parents / family", weight: 40, current: 0, target: 8, unit: "" },
      { label: "Calls / check-ins with loved ones", weight: 30, current: 0, target: 10, unit: "" },
      { label: "Meaningful meetups with friends", weight: 15, current: 0, target: 4, unit: "" },
      { label: "Write a letter / message of gratitude", weight: 15, current: 0, target: 2, unit: "" },
    ],
    results: [],
    rewards: [],
  },
  {
    name: "Discipline & Mind",
    dotColor: "white",
    actions: [
      { label: "Days waking up before 7am", weight: 15, current: 0, target: 20, unit: "" },
      { label: "Mornings without phone first hour", weight: 15, current: 0, target: 20, unit: "" },
      { label: "Journaling entries", weight: 10, current: 0, target: 15, unit: "" },
      { label: "Meditation sessions", weight: 15, current: 0, target: 15, unit: "" },
      { label: "Daily fundamentals done (3 non-negotiables)", weight: 25, current: 0, target: 1, unit: "", resetType: "daily" },
      { label: "Weekly review & plan", weight: 20, current: 0, target: 1, unit: "", resetType: "weekly" },
    ],
    results: [{ label: "Average daily screen time", current: 6.5, target: 3.0, unit: "h" }],
    rewards: [],
  },
  {
    name: "Rewards",
    dotColor: "turquoise",
    actions: [],
    results: [],
    isRewards: true,
    rewards: generateRewardTiers(),
  },
];

export async function seedUserCategories(prisma, userId) {
  let sortOrder = 0;
  const created = [];
  for (const cat of DEFAULT_CATEGORIES) {
    const category = await prisma.category.create({
      data: {
        userId,
        name: cat.name,
        dotColor: cat.dotColor,
        sortOrder: sortOrder++,
        expanded: true,
        actions: {
          create: cat.actions.map((a, i) => ({
            label: a.label,
            weight: a.weight,
            current: a.current,
            target: a.target,
            unit: a.unit || null,
            resetType: a.resetType || "monthly",
            sortOrder: i,
          })),
        },
        results: {
          create: cat.results.map((r, i) => ({
            label: r.label,
            current: r.current,
            target: r.target,
            unit: r.unit || null,
            sortOrder: i,
          })),
        },
        rewards: {
          create: cat.rewards.map((r) => ({
            name: r.name,
            cost: r.cost,
            thresholdType: r.thresholdType || "score",
            period: r.period || "monthly",
            linkedResultId: r.linkedResultId || null,
          })),
        },
      },
      include: { actions: true, results: true, rewards: true },
    });
    created.push(category);
  }
  return created;
}
