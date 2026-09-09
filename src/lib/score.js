import { userData } from "../data/goals";

// Mirrors server/src/lib/calc.js so client & server compute identically.

export function actionPct(a) {
  return a.target > 0 ? Math.min((a.current / a.target) * 100, 100) : 0;
}

export function resultPct(r) {
  if (!r.target || r.target <= 0) return 0;
  if (r.invert) {
    if (r.current <= r.target) return 100;
    return Math.max(0, 100 - ((r.current - r.target) / r.target) * 100);
  }
  return Math.min((r.current / r.target) * 100, 100);
}

// Overall results completion across categories, weighted like categoryPct.
export function aggregateResultsPct(categories) {
  const all = (categories || []).filter((c) => !c.isRewards);
  let totalWeight = 0;
  let weightedSum = 0;
  for (const cat of all) {
    for (const r of cat.results || []) {
      if (r.target > 0) {
        const w = r.weight || 0;
        totalWeight += w;
        const pct = Math.min((r.current / r.target) * 100, 100);
        weightedSum += pct * w;
      }
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function categoryPct(cat) {
  const actions = (cat.actions || []).filter((a) => !a._deleted);
  const results = (cat.results || []).filter((r) => !r._deleted);
  const totalWeight = actions.reduce((sum, a) => sum + (a.weight || 0), 0)
    + results.reduce((sum, r) => sum + (r.weight || 0), 0);
  if (totalWeight === 0) return 0;
  const weightedSum = actions.reduce(
    (sum, a) => sum + actionPct(a) * (a.weight || 0),
    0
  ) + results.reduce(
    (sum, r) => sum + resultPct(r) * (r.weight || 0),
    0
  );
  return weightedSum / totalWeight;
}

export function computeOverallPct(cats) {
  const actives = (cats || []).filter(
    (c) => !c.isRewards && (c.actions || []).filter((a) => !a._deleted).length > 0
  );
  if (actives.length === 0) return 0;
  const total = actives.reduce((acc, cat) => acc + categoryPct(cat), 0);
  return total / actives.length;
}

export function expectedPct() {
  return (userData.daysPassed / userData.totalDays) * 100;
}

export function statusOf(actualPct, expPct, tolerance = 3) {
  if (actualPct >= expPct + tolerance) return "AHEAD";
  if (actualPct <= expPct - tolerance) return "BEHIND";
  return "ON TRACK";
}

/** Semantic color is computed output only — never used decoratively. */
export function statusColor(statusOrActual, expected, tolerance = 3) {
  if (typeof statusOrActual === "string") {
    // called with a status string
    switch (statusOrActual) {
      case "AHEAD":
        return "#6DF5E3";
      case "BEHIND":
        return "#DB6088";
      default:
        return "#8FA8A3";
    }
  }
  // called with (actual, expected) numeric
  const status = statusOf(statusOrActual, expected, tolerance);
  if (status === "AHEAD") return "#6DF5E3";
  if (status === "BEHIND") return "#DB6088";
  return "#8FA8A3";
}

export function categoryWeightsSum(cat) {
  return (cat.actions || [])
    .filter((a) => !a._deleted)
    .reduce((sum, a) => sum + (a.weight || 0), 0);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
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

export function checkRewardUnlock(reward, state) {
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
 * Mirror of server calculateDashboardState. Takes categories with nested
 * actions/results/rewards (may include client-generated _deleted flags).
 */
export function calculateDashboardState(categories, date = new Date(), monthOffset = 0) {
  const targetDate = new Date(date);
  targetDate.setMonth(targetDate.getMonth() + (monthOffset || 0));

  const daysInMonth = getDaysInMonth(targetDate);
  const dayOfMonth = targetDate.getDate();
  const daysLeft = daysInMonth - dayOfMonth;

  const qualityPercent = Math.round(computeOverallPct(categories));
  const expectedPercent = expectedPct();
  const status = statusOf(qualityPercent, expectedPercent);
  const statusCol = statusColor(status);

  const finance = (categories || []).find((c) => c.name?.toLowerCase().includes("finance"));
  const investResult = (finance?.results || []).find((r) => r.unit === "$");
  const investAmount = investResult ? investResult.current : 0;
  const investTarget = investResult ? investResult.target : 1000;

  const cumulative = [];
  for (let d = 1; d <= dayOfMonth; d++) {
    const ratio = d / daysInMonth;
    const value = Math.round(ratio * qualityPercent * 10) / 10;
    cumulative.push({ day: d, value, color: statusColor(value, (d / daysInMonth) * 100) });
  }

  const shouldBe = [];
  for (let d = 1; d <= daysInMonth; d++) {
    shouldBe.push({ day: d, value: Math.round((d / daysInMonth) * 100 * 10) / 10 });
  }

  const goals = [5, 10, 15, 20, 25, 30]
    .filter((d) => d <= daysInMonth)
    .map((d) => ({ day: d, value: Math.round((d / daysInMonth) * 100 * 10) / 10 }));

  const catOut = (categories || []).map((cat) => {
    const percent = cat.isRewards ? 0 : Math.round(categoryPct(cat));
    const actions = (cat.actions || []).map((a) => ({
      ...a,
      percent: Math.round(actionPct(a)),
      statusColor: statusColor(actionPct(a), expectedPercent),
      expectedPace: expectedPercent,
    }));
    const results = (cat.results || []).map((r) => ({
      ...r,
      percent: Math.round(resultPct(r)),
    }));
    return {
      id: cat.id,
      name: cat.name,
      dotColor: cat.dotColor || "turquoise",
      percent,
      statusColor: cat.isRewards ? "turquoise" : statusColor(percent, expectedPercent),
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

  return {
    meta: {
      currentDate: targetDate.toISOString(),
      daysInMonth,
      dayOfMonth,
      daysLeft,
      monthName: MONTHS[targetDate.getMonth()],
      year: targetDate.getFullYear(),
    },
    stats: {
      educationPercent: 0,
      qualityPercent,
      investAmount,
      investTarget,
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
    chartData: { shouldBe, cumulative, goals },
    categories: catOut,
    rewards,
  };
}
