// Pure calculation engine. Can run server-side (given DB rows) or client-side
// (given the same-shaped plain objects). No I/O, no side effects.

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function calculateActionPercent(action) {
  if (!action.target || action.target <= 0) return 0;
  return Math.min((action.current / action.target) * 100, 100);
}

export function calculateResultPercent(result) {
  if (!result.target || result.target <= 0) return 0;
  if (result.invert) {
    if (result.current <= result.target) return 100;
    return Math.max(0, 100 - ((result.current - result.target) / result.target) * 100);
  }
  return (result.current / result.target) * 100;
}

export function calculateCategoryPercent(category) {
  const actions = category.actions || [];
  const results = category.results || [];
  const totalWeight = actions.reduce((sum, a) => sum + (a.weight || 0), 0)
    + results.reduce((sum, r) => sum + (r.weight || 0), 0);
  if (totalWeight === 0) return 0;
  const weightedSum = actions.reduce(
    (sum, a) => sum + calculateActionPercent(a) * (a.weight || 0),
    0
  ) + results.reduce(
    (sum, r) => sum + calculateResultPercent(r) * (r.weight || 0),
    0
  );
  return weightedSum / totalWeight;
}

export function calculateOverallQuality(categories) {
  const actives = (categories || []).filter(
    (c) => !c.isRewards && (c.actions || []).length > 0
  );
  if (actives.length === 0) return 0;
  const total = actives.reduce((acc, cat) => acc + calculateCategoryPercent(cat), 0);
  return total / actives.length;
}

export function getExpectedPercent(date, monthOffset = 0) {
  const target = new Date(date);
  target.setMonth(target.getMonth() + monthOffset);
  const day = target.getDate();
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return (day / daysInMonth) * 100;
}

export function getDaysLeft(date, monthOffset = 0) {
  const target = new Date(date);
  target.setMonth(target.getMonth() + monthOffset);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return daysInMonth - target.getDate();
}

export function getDaysInMonth(date, monthOffset = 0) {
  const target = new Date(date);
  target.setMonth(target.getMonth() + monthOffset);
  return new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
}

export function getStatus(actual, expected, tolerance = 3) {
  if (actual >= expected + tolerance) return "AHEAD";
  if (actual <= expected - tolerance) return "BEHIND";
  return "ON TRACK";
}

export function statusColor(actual, expected, tolerance = 3) {
  const status = getStatus(actual, expected, tolerance);
  if (status === "AHEAD") return "turquoise";
  if (status === "BEHIND") return "red";
  return "grey";
}

export function resultPercent(result) {
  if (!result.target || result.target <= 0) return 0;
  if (result.invert) {
    if (result.current <= result.target) return 100;
    return Math.max(0, 100 - ((result.current - result.target) / result.target) * 100);
  }
  return (result.current / result.target) * 100;
}

export function categoryWeightsSum(category) {
  return (category.actions || []).reduce((sum, a) => sum + (a.weight || 0), 0);
}

function financeRevenue(state) {
  const finance = (state.categories || []).find((c) =>
    c.name?.toLowerCase().includes("finance")
  );
  const dollar = (finance?.results || []).find((r) => r.unit === "$");
  return dollar ? dollar.current : 0;
}

function allActionsOfResetTypeComplete(categories, resetType) {
  const goals = (categories || [])
    .filter((c) => !c.isRewards)
    .flatMap((c) => (c.actions || []).filter((a) => a.resetType === resetType));
  if (goals.length === 0) return false; // no such goal set -> always locked
  return goals.every((a) => a.current >= a.target);
}

function checkRewardUnlock(reward, state) {
  if (reward.claimed) return true;
  if (reward.thresholdType === "daily") {
    return allActionsOfResetTypeComplete(state.categories, "daily");
  }
  if (reward.thresholdType === "weekly") {
    return allActionsOfResetTypeComplete(state.categories, "weekly");
  }
  if (reward.thresholdType === "action" && reward.linkedActionId) {
    for (const cat of state.categories) {
      const action = (cat.actions || []).find((a) => a.id === reward.linkedActionId);
      if (action) {
        if (!action.target || action.target <= 0) return false;
        const pct = Math.min((action.current / action.target) * 100, 100);
        return pct >= (reward.linkedPercent ?? 100);
      }
    }
    return false;
  }
  if (reward.linkedResultId) {
    for (const cat of state.categories) {
      const result = (cat.results || []).find((r) => r.id === reward.linkedResultId);
      if (result) {
        if (!result.target || result.target <= 0) return false;
        const pct = result.invert
          ? (result.current <= result.target ? 100 : Math.max(0, 100 - ((result.current - result.target) / result.target) * 100))
          : (result.current / result.target) * 100;
        return pct >= (reward.linkedPercent ?? 100);
      }
    }
    return false;
  }
  const threshold = reward.threshold ?? reward.cost;
  if (reward.thresholdType === "revenue") {
    return financeRevenue(state) >= threshold;
  }
  return state.stats.qualityPercent >= threshold;
}

/**
 * Build the full DashboardState from raw category data + a target date.
 * @param {Array} categories rows with nested actions/results/rewards (plain obj)
 * @param {Date} date
 * @param {number} monthOffset
 */
export function calculateDashboardState(categories, date = new Date(), monthOffset = 0) {
  const targetDate = new Date(date);
  targetDate.setMonth(targetDate.getMonth() + monthOffset);

  const daysInMonth = getDaysInMonth(targetDate);
  const dayOfMonth = targetDate.getDate();
  const daysLeft = daysInMonth - dayOfMonth;

  const qualityPercent = Math.round(calculateOverallQuality(categories));
  const expectedPercent = getExpectedPercent(targetDate);
  const status = getStatus(qualityPercent, expectedPercent);
  const statusCol = statusColor(qualityPercent, expectedPercent);

  const finance = (categories || []).find((c) => c.name?.toLowerCase().includes("finance"));
  const investResult = (finance?.results || []).find((r) => r.unit === "$");
  const investAmount = investResult ? investResult.current : 0;
  const investTarget = investResult ? investResult.target : 1000;

  // Cumulative (actual) chart data: flat near zero, ticks up toward qualityPercent.
  const cumulative = [];
  for (let d = 1; d <= dayOfMonth; d++) {
    const ratio = d / daysInMonth;
    const value = Math.round(ratio * qualityPercent * 10) / 10;
    cumulative.push({
      day: d,
      value,
      color: statusColor(value, (d / daysInMonth) * 100),
    });
  }

  // Should-Be: straight diagonal pace line for the whole month.
  const shouldBe = [];
  for (let d = 1; d <= daysInMonth; d++) {
    shouldBe.push({ day: d, value: Math.round((d / daysInMonth) * 100 * 10) / 10 });
  }

  // Goals markers on the should-be line at tick days.
  const goals = [5, 10, 15, 20, 25, 30]
    .filter((d) => d <= daysInMonth)
    .map((d) => ({ day: d, value: Math.round((d / daysInMonth) * 100 * 10) / 10 }));

  const catOut = (categories || []).map((cat) => {
    const percent = cat.isRewards ? 0 : Math.round(calculateCategoryPercent(cat));
    const expected = expectedPercent;
    const actions = (cat.actions || []).map((a) => ({
      ...a,
      percent: Math.round(calculateActionPercent(a)),
      statusColor: statusColor(calculateActionPercent(a), expected),
      expectedPace: expected,
    }));
    const results = (cat.results || []).map((r) => ({
      ...r,
      percent: Math.round(resultPercent(r)),
    }));
    return {
      id: cat.id,
      name: cat.name,
      dotColor: cat.dotColor || "turquoise",
      percent,
      statusColor: cat.isRewards ? "turquoise" : statusColor(percent, expected),
      expanded: cat.expanded !== false,
      isRewards: !!cat.isRewards || cat.name?.toLowerCase() === "rewards",
      actions,
      results,
      rewards: (cat.rewards || []).map((r) => ({
        ...r,
        thresholdType: r.thresholdType || "score",
        period: r.period || "monthly",
        unlocked: checkRewardUnlock(r, { categories, stats: { qualityPercent } }),
      })),
    };
  });

  const interimState = { categories: catOut, stats: { qualityPercent } };

  const rewards = (categories || [])
    .filter((c) => (c.rewards || []).length)
    .flatMap((cat) =>
      (cat.rewards || []).map((r) => {
        const unlocked = checkRewardUnlock(r, interimState);
        return {
          id: r.id,
          name: r.name,
          cost: r.cost,
          threshold: r.threshold ?? r.cost,
          period: r.period || "monthly",
          thresholdType: r.thresholdType || "score",
          linkedResultId: r.linkedResultId || undefined,
          linkedActionId: r.linkedActionId || undefined,
          linkedPercent: r.linkedPercent ?? null,
          claimed: !!r.claimed,
          unlocked,
          unlockColor: unlocked ? "green" : "red",
        };
      })
    );

  const investTargetSafe = investTarget || 1000;

  const dashboardState = {
    meta: {
      currentDate: targetDate.toISOString(),
      daysInMonth,
      dayOfMonth,
      daysLeft,
      monthName: MONTHS[targetDate.getMonth()],
      year: targetDate.getFullYear(),
    },
    stats: {
      educationPercent: 0, // education sub-task metric not modeled in schema; defaults 0
      qualityPercent,
      investAmount,
      investTarget: investTargetSafe,
      daysLeft,
      status,
      statusColor: statusCol,
      expectedPercent: Math.round(expectedPercent * 10) / 10,
      actualPercent: qualityPercent,
      daysProgress: `${dayOfMonth}/${daysInMonth}`,
    },
    overallProgress: {
      monthPercent: Math.round(expectedPercent),
      actualPercent: qualityPercent,
      expectedPercent: Math.round(expectedPercent),
      daysFraction: `${dayOfMonth}/${daysInMonth}`,
    },
    chartData: {
      shouldBe,
      cumulative,
      goals,
    },
    categories: catOut,
    rewards,
  };

  return dashboardState;
}
