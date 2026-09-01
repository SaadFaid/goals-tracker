import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateActionPercent,
  calculateCategoryPercent,
  calculateOverallQuality,
  getExpectedPercent,
  getDaysLeft,
  getDaysInMonth,
  getStatus,
  statusColor,
  resultPercent,
  calculateDashboardState,
} from "../src/lib/calc.js";

test("action percent clamps at 100", () => {
  assert.equal(calculateActionPercent({ current: 10, target: 20 }), 50);
  assert.equal(calculateActionPercent({ current: 25, target: 20 }), 100);
  assert.equal(calculateActionPercent({ current: 0, target: 0 }), 0);
});

test("category percent is weighted average", () => {
  const cat = {
    actions: [
      { current: 10, target: 20, weight: 50 }, // 50%
      { current: 0, target: 10, weight: 50 },  // 0%
    ],
  };
  // (50*50 + 0*50)/100 = 25
  assert.equal(calculateCategoryPercent(cat), 25);
});

test("overall quality averages category percents", () => {
  const cats = [
    { actions: [{ current: 10, target: 20, weight: 100 }] }, // 50
    { actions: [{ current: 5, target: 10, weight: 100 }] },  // 50
    { actions: [{ current: 0, target: 10, weight: 100 }] },  // 0
    { isRewards: true, actions: [] },
    { actions: [] }, // no actions -> skipped
  ];
  assert.ok(Math.abs(calculateOverallQuality(cats) - 100 / 3) < 1e-9);
});

test("expected percent and days left align", () => {
  const date = new Date("2026-08-28T12:00:00Z");
  assert.equal(getDaysInMonth(date), 31);
  assert.equal(getDaysLeft(date), 3);
  const exp = getExpectedPercent(date);
  assert.ok(Math.abs(exp - (28 / 31) * 100) < 0.001);
});

test("status thresholds", () => {
  assert.equal(getStatus(90, 90), "ON TRACK");
  assert.equal(getStatus(95, 90), "AHEAD"); // +5 >= +3 -> AHEAD
  assert.equal(getStatus(92, 90), "ON TRACK"); // within +3
  assert.equal(getStatus(60, 90), "BEHIND");
});

test("status with custom tolerance", () => {
  assert.equal(getStatus(60, 90, 3), "BEHIND");
  assert.equal(getStatus(92, 90, 1), "AHEAD");
});

test("statusColor mapping", () => {
  assert.equal(statusColor(60, 90), "red");      // BEHIND -> red
  assert.equal(statusColor(90, 90), "grey");      // ON TRACK (~90%) -> grey
  assert.equal(statusColor(99, 90), "turquoise"); // AHEAD -> turquoise
});

test("result percent with invert", () => {
  assert.equal(resultPercent({ current: 79, target: 72 }), (79 / 72) * 100);
  assert.equal(resultPercent({ current: 72, target: 72, invert: true }), 100);
  assert.equal(resultPercent({ current: 60, target: 72, invert: true }), 100);
});

test("dashboard state shape and cumulative data", () => {
  const cats = [
    {
      id: "c1",
      name: "Finance",
      dotColor: "turquoise",
      actions: [],
      results: [{ id: "r1", label: "Money earned", current: 0, target: 1000, unit: "$" }],
      rewards: [],
      isRewards: false,
    },
    {
      id: "c2",
      name: "Business & Career",
      dotColor: "white",
      actions: [
        { id: "a1", label: "Deep work", weight: 40, current: 0, target: 20 },
        { id: "a2", label: "Clients", weight: 30, current: 0, target: 10 },
        { id: "a3", label: "Ship", weight: 30, current: 0, target: 1 },
      ],
      results: [],
      rewards: [],
      isRewards: false,
    },
    {
      id: "c-rewards",
      name: "Rewards",
      isRewards: true,
      actions: [],
      results: [],
      rewards: [
        { id: "rw1", name: "Dinner", cost: 200 },
        { id: "rw2", name: "Day off", cost: 100 },
      ],
    },
  ];

  const state = calculateDashboardState(cats, new Date("2026-08-28T12:00:00Z"));

  assert.equal(state.meta.daysLeft, 3);
  assert.equal(state.stats.status, "BEHIND");
  assert.equal(state.categories.length, 3);
  assert.equal(state.cumulativeUndefined, undefined);
  // rewards unresolved cost of 100/200 still locked (quality ~0)
  assert.ok(state.rewards.every((r) => r.unlocked === false && r.unlockColor === "red"));
  assert.equal(state.chartData.shouldBe.length, 31);
  assert.equal(state.chartData.cumulative.length, 28);
});

test("reward unlock respects thresholdType (score vs revenue)", () => {
  const cats = [
    {
      id: "c-fin",
      name: "Finance",
      actions: [],
      results: [{ id: "rf", label: "Money earned", current: 0, target: 1000, unit: "$" }],
      rewards: [],
    },
    {
      id: "c-rewards",
      name: "Rewards",
      isRewards: true,
      actions: [],
      results: [],
      rewards: [
        { id: "w1", name: "Score reward (score type)", cost: 60, thresholdType: "score" },
        { id: "w2", name: "Revenue reward (revenue type)", cost: 40, thresholdType: "revenue" },
      ],
    },
  ];

  // quality ~0 but finance revenue 0 too -> both locked
  let state = calculateDashboardState(cats, new Date("2026-08-28T12:00:00Z"));
  assert.ok(state.rewards.find((r) => r.id === "w1").unlocked === false);
  assert.ok(state.rewards.find((r) => r.id === "w2").unlocked === false);

  // score reward unlocks on qualityPercent, revenue reward stays locked
  cats.find((c) => c.id === "c-fin").results[0].current = 0;
  const catsScore = cats.map((c) => ({
    ...c,
    actions: c.actions.length ? c.actions : [{ id: "a", label: "a", weight: 100, current: 60, target: 100 }],
  }));
  state = calculateDashboardState(catsScore, new Date("2026-08-28T12:00:00Z"));
  assert.equal(state.stats.qualityPercent, 60);
  assert.ok(state.rewards.find((r) => r.id === "w1").unlocked === true); // 60 >= 60
  assert.ok(state.rewards.find((r) => r.id === "w2").unlocked === false); // revenue still 0

  // revenue reward unlocks on finance revenue, score reward still locked on its own metric
  const catsRev = cats.map((c) => ({
    ...c,
    actions: c.actions.length ? c.actions : [{ id: "a", label: "a", weight: 100, current: 30, target: 100 }],
    results: c.results.map((r) => (r.id === "rf" ? { ...r, current: 45 } : r)),
  }));
  state = calculateDashboardState(catsRev, new Date("2026-08-28T12:00:00Z"));
  assert.equal(state.stats.qualityPercent, 30);
  assert.ok(state.rewards.find((r) => r.id === "w1").unlocked === false); // quality 30 < 60
  assert.ok(state.rewards.find((r) => r.id === "w2").unlocked === true); // revenue 45 >= 40
});

test("daily & weekly rewards unlock by completing that period's actions", () => {
  const cats = [
    {
      id: "c-dis",
      name: "Discipline",
      actions: [
        { id: "a1", label: "Daily fundamentals", weight: 100, current: 0, target: 1, resetType: "daily" },
        { id: "a2", label: "Weekly review", weight: 100, current: 0, target: 1, resetType: "weekly" },
      ],
      results: [],
      rewards: [],
    },
    {
      id: "c-rewards",
      name: "Rewards",
      isRewards: true,
      actions: [],
      results: [],
      rewards: [
        { id: "d1", name: "Daily treat", cost: 0, thresholdType: "daily", period: "daily" },
        { id: "d2", name: "Weekly night out", cost: 0, thresholdType: "weekly", period: "weekly" },
      ],
    },
  ];
  const date = new Date("2026-08-28T12:00:00Z");

  // no actions complete -> both locked
  let state = calculateDashboardState(cats, date);
  assert.ok(state.rewards.find((r) => r.id === "d1").unlocked === false);
  assert.ok(state.rewards.find((r) => r.id === "d2").unlocked === false);

  // daily action done -> daily unlocks, weekly stays locked
  state = calculateDashboardState(cats.map((c) => (
    c.id === "c-dis"
      ? { ...c, actions: c.actions.map((a) => (a.id === "a1" ? { ...a, current: 1 } : a)) }
      : c
  )), date);
  assert.ok(state.rewards.find((r) => r.id === "d1").unlocked === true);
  assert.ok(state.rewards.find((r) => r.id === "d2").unlocked === false);

  // weekly action done too -> weekly unlocks
  state = calculateDashboardState(cats.map((c) => (
    c.id === "c-dis"
      ? { ...c, actions: c.actions.map((a) => ({ ...a, current: 1 })) }
      : c
  )), date);
  assert.ok(state.rewards.find((r) => r.id === "d1").unlocked === true);
  assert.ok(state.rewards.find((r) => r.id === "d2").unlocked === true);
});
