import { create } from "zustand";
import { persist } from "zustand/middleware";
import { categories as seedCategories, generateRewardTiers } from "../data/goals";
import { calculateDashboardState } from "../lib/score";
import { api } from "../lib/api";
import { generateGuestLogs } from "../lib/guestLogs";

const GUEST_KEY = "august-goals-guest-v2";
const PROFILES_KEY = "august-goals-profiles";

// ── Local profiles (frontend-only accounts) ────────────
// Each user is a profile stored in localStorage on this device:
//   { [email]: { name, passHash, categories } }
// No backend involved — data never leaves this browser.
function readProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY)) || {};
  } catch {
    return {};
  }
}
function writeProfiles(map) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(map));
}

async function hashPassword(pw) {
  const data = new TextEncoder().encode("august-goals::" + pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Client generates UUIDs for offline/optimistic items before server assigns real ones.
function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// "YYYY-MM" key for a Date's month (current real month by default).
function monthKeyOf(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function localMonthKey() {
  return monthKeyOf();
}
function dateOfMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1);
}
// "YYYY-MM" key of the month before the given key (null if unparseable).
function prevMonthKey(key) {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return null;
  return monthKeyOf(new Date(y, m - 2, 1));
}

// Targeted immutable update: replace only the matching category (cloned) so the
// references of sibling categories stay stable. This lets React.memo on cards
// skip re-rendering unaffected categories. Returns the SAME array reference if
// the category is not found, so callers can bail without scheduling a render.
function replaceCategory(cats, catId, mutator) {
  let found = false;
  const next = cats.map((c) => {
    if (c.id !== catId) return c;
    found = true;
    return mutator(deepClone(c));
  });
  return found ? next : cats;
}

// Client seed uses `color` hex (TURQUOISE/WHITE); normalize to `dotColor` token
// and add fields components/schema expect. `isRewards` defaults to false.
const HEX_TO_DOT = {
  "#6df5e3": "turquoise",
  "#2dd4bf": "turquoise",
  "#ffffff": "white",
};

// Normalize a category into the schema shape used everywhere.
function seedClone() {
  return deepClone(seedCategories).map((c) => {
    const dotColor =
      c.dotColor ||
      (c.color ? HEX_TO_DOT[c.color.toLowerCase()] || "turquoise" : "turquoise");
    const isRewards = !!c.isRewards;
    return {
      id: c.id || uid(),
      name: c.name,
      dotColor,
      expanded: c.expanded !== false,
      isRewards,
      actions: (c.actions || []).map((a) => ({ ...a, id: a.id || uid(), invert: !!a.invert })),
      results: (c.results || []).map((r) => ({ ...r, id: r.id || uid(), isBadge: !!r.isBadge, invert: !!r.invert })),
      rewards: (c.rewards || []).map((r) => ({
        id: r.id || uid(),
        name: r.name,
        cost: r.cost,
        threshold: r.threshold,
        thresholdType: r.thresholdType || "score",
        period: r.period || "monthly",
        claimed: !!r.claimed,
      })),
    };
  });
}

// Stale snapshots (pre-rewards, or sessions saved before tier changes) may
// carry a Rewards category with zero rewards or a missing isRewards flag.
// Detect the rewards card by name (mirrors calc.js/score.js), refill tiers
// from generated output. Returns the SAME array reference when untouched.
function ensureRewardTiers(cats) {
  let changed = false;
  const next = cats.map((c) => {
    const isRewards = !!c.isRewards || c.name?.toLowerCase() === "rewards";
    if (!isRewards) return c;
    if (!c.isRewards) changed = true;
    if ((c.rewards || []).length > 0) return { ...c, isRewards: true };
    changed = true;
    return {
      ...c,
      isRewards: true,
      rewards: generateRewardTiers().map((r) => ({ ...r, id: r.id || uid() })),
    };
  });
  return changed ? next : cats;
}

const emptyState = () => ({
  user: null,
  isGuest: true,
  sessionStarted: false,
  bootstrapped: false,
  loading: false,
  error: null,
  lastSyncedAt: null,
  progressLogs: [],
  undoStack: [],
  pendingMutations: [],
  editMode: false,
  monthOffset: 0,
  selectedMonth: localMonthKey(),
  viewingHistory: false,
  liveCategories: null,
  monthlySnapshots: {},
  serverSnapshotMonths: [],
});

export const useGoalsStore = create(
  persist(
    (set, get) => ({
      ...emptyState(),
      categories: seedClone(),

      derive() {
        const dashboard = calculateDashboardState(get().categories, new Date(), get().monthOffset);
        set({ dashboard, bootstrapped: true });
        return dashboard;
      },

      setMonthOffset(offset) {
        const monthOffset = Number(offset) || 0;
        const dashboard = calculateDashboardState(get().categories, new Date(), monthOffset);
        set({ monthOffset, dashboard, bootstrapped: true });
      },

      // ── Month snapshots & history viewing ───────────────
      // Save the current live categories under the selected (live) month so we
      // can restore them page-wide later. Non-guest users also persist to the
      // server for cross-device history.
      captureSnapshot() {
        const s = get();
        if (s.viewingHistory) return;
        const key = monthKeyOf();
        if (!key) return;
        const data = deepClone(s.categories);
        set((st) => ({
          monthlySnapshots: {
            ...st.monthlySnapshots,
            [key]: data,
          },
        }));
        if (!get().isGuest) {
          api.saveSnapshot(key, deepClone(data)).catch(() => {});
        }
      },

      async loadSnapshotMonths() {
        if (get().isGuest) return;
        try {
          const { months } = await api.snapshots();
          set({ serverSnapshotMonths: Array.isArray(months) ? months : [] });
        } catch {
          /* non-fatal: fall back to local month cache */
        }
      },

      goLive() {
        const s = get();
        const liveKey = monthKeyOf();
        const categories = s.liveCategories ? deepClone(s.liveCategories) : s.categories;
        const dashboard = calculateDashboardState(categories, new Date(), 0);
        set({
          selectedMonth: liveKey,
          viewingHistory: false,
          liveCategories: null,
          categories,
          dashboard,
          bootstrapped: true,
        });
      },

      async switchMonth(key) {
        if (!key) return;
        const liveKey = monthKeyOf();
        if (key === liveKey) {
          get().goLive();
          return;
        }

        const s = get();
        const liveCategories = s.liveCategories || deepClone(s.categories);

        const apply = (snapshot) => {
          const data = Array.isArray(snapshot) ? snapshot : [];
          const dashboard = calculateDashboardState(data, dateOfMonthKey(key), 0);
          set({
            selectedMonth: key,
            viewingHistory: true,
            liveCategories,
            categories: deepClone(data),
            dashboard,
            bootstrapped: true,
            ...(data.length ? { monthlySnapshots: { ...get().monthlySnapshots, [key]: data } } : {}),
          });
        };

        if (s.monthlySnapshots[key]) {
          apply(s.monthlySnapshots[key]);
          return;
        }

        if (!get().isGuest && s.serverSnapshotMonths.includes(key)) {
          try {
            const { data } = await api.snapshot(key);
            apply(data);
          } catch {
            apply([]);
          }
          return;
        }

        apply([]);
      },

      pushUndo() {
        set((s) => ({ undoStack: [...s.undoStack.slice(-9), deepClone(s.categories)] }));
      },

      // ── Boot ────────────────────────────────────────────
      bootstrap: () => {
        let categories = get().categories;
        if (get().viewingHistory && get().liveCategories) {
          // Reloaded while viewing a past month — return to live editing mode.
          categories = deepClone(get().liveCategories);
          set({ categories, viewingHistory: false, liveCategories: null });
        }
        categories = ensureRewardTiers(categories);
        const dashboard = calculateDashboardState(categories, new Date(), get().monthOffset);
        set({
          categories,
          dashboard,
          bootstrapped: true,
          progressLogs: get().progressLogs.length > 0 ? get().progressLogs : generateGuestLogs(categories),
        });
      },

      startGuest: () => {
        set({ user: null, isGuest: true, sessionStarted: true, progressLogs: generateGuestLogs(get().categories) });
        get().derive();
        get().captureSnapshot();
      },

      openAuth: () => {
        set({ sessionStarted: false });
      },

      // ── Auth lifecycle (frontend-only local profiles) ──
      // No backend: "accounts" are name+password entries stored in this
      // browser's localStorage, each holding that user's own categories.

      // Persist the currently logged-in user's categories back into their
      // profile slot so edits survive logout and future visits.
      persistLocalProfile: () => {
        const s = get();
        if (!s.user?.email) return;
        const map = readProfiles();
        const slot = map[s.user.email];
        if (!slot) return;
        map[s.user.email] = { ...slot, categories: deepClone(s.categories) };
        writeProfiles(map);
      },

      applyLocalProfile: (email, { name = "User" } = {}) => {
        set({
          user: { email, name },
          isGuest: false,
          sessionStarted: true,
          error: null,
          lastSyncedAt: new Date().toISOString(),
          progressLogs: generateGuestLogs(get().categories),
        });
        get().derive();
      },

      register: async (credentials) => {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !/.+@.+\..+/.test(email)) {
          set({ error: "Enter a valid email address", loading: false });
          throw new Error("Enter a valid email address");
        }
        if (password.length < 4) {
          set({ error: "Password must be at least 4 characters", loading: false });
          throw new Error("Password must be at least 4 characters");
        }
        const map = readProfiles();
        if (map[email]) {
          const msg = "An account with this email already exists. Log in instead.";
          set({ error: msg, loading: false });
          throw new Error(msg);
        }
        const passHash = await hashPassword(password);
        map[email] = { name: String(credentials?.name || "User").trim() || "User", passHash, categories: seedClone() };
        writeProfiles(map);
        get().applyLocalProfile(email, map[email]);
      },

      login: async (credentials) => {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        const map = readProfiles();
        const slot = map[email];
        if (!slot) {
          const msg = "No account found with that email. Register first.";
          set({ error: msg, loading: false });
          throw new Error(msg);
        }
        const passHash = await hashPassword(password);
        if (passHash !== slot.passHash) {
          const msg = "Incorrect password. Try again.";
          set({ error: msg, loading: false });
          throw new Error(msg);
        }
        get().commit(slot.categories); // load this user's own stats
        get().applyLocalProfile(email, slot);
      },

      logout: () => {
        get().persistLocalProfile();
        set({
          user: null,
          isGuest: true,
          sessionStarted: false,
          categories: seedClone(),
          lastSyncedAt: null,
          undoStack: [],
          pendingMutations: [],
        });
        get().derive();
      },

      syncToAccount: async (mode = "merge") => {
        if (get().isGuest) throw new Error("Not authenticated");
        const payload = { mode, categories: get().categories };
        const { dashboard } = await api.sync(payload);
        set({ categories: ensureRewardTiers(deepClone(dashboard.categories)), lastSyncedAt: new Date().toISOString() });
        const d = calculateDashboardState(get().categories, new Date(), get().monthOffset);
        set({ dashboard: d, bootstrapped: true });
        get().loadProgress();
      },

      // ── Generic persist+sync after a local mutation ────
      commit: (nextCategories, { apiCall } = {}) => {
        const act = () => {
          set({ categories: nextCategories });
          if (apiCall) get().enqueue({ execute: apiCall });
          get().persistLocalProfile();
          const dashboard = calculateDashboardState(nextCategories, new Date(), get().monthOffset);
          set({
            dashboard,
            bootstrapped: true,
            lastSyncedAt: new Date().toISOString(),
          });
          get().captureSnapshot();
        };
        get().pushUndo();
        act();
        return nextCategories;
      },

      // ── Optimistic + queue mutation ─────────────────────
      enqueue: (entry) => {
        set((s) => ({
          pendingMutations: [...s.pendingMutations, { id: uid(), timestamp: Date.now(), ...entry }],
        }));
        if (!get().isGuest) get().flush();
      },

      flush: async () => {
        // No backend in the frontend-only build. Local profiles are fully
        // local; there is nothing to sync, so drop the pending queue.
        set({ pendingMutations: [] });
      },

      retryAll: () => get().flush(),

      // ── UI edit mode ─────────────────────────────────────
      // Off: cards are clean — check-in + minus only.
      // On: reveals create/delete/edit controls everywhere.
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

      // ── Undo ────────────────────────────────────────────
      undo: () => {
        const { undoStack, categories } = get();
        if (undoStack.length === 0) return false;
        const previous = undoStack[undoStack.length - 1];
        set((s) => ({
          undoStack: s.undoStack.slice(0, -1),
          categories: previous,
          undoPrev: categories,
        }));
        const dashboard = calculateDashboardState(previous, new Date(), get().monthOffset);
        set({ dashboard, bootstrapped: true });
        return true;
      },

      redo: () => {
        const { undoPrev } = get();
        if (!undoPrev) return false;
        set({ categories: undoPrev, undoPrev: undefined });
        const dashboard = calculateDashboardState(undoPrev, new Date(), get().monthOffset);
        set({ dashboard, bootstrapped: true });
        return true;
      },

      // ── CRUD actions (operate on categories, sync if authed) ──
      updateAction: (catId, idx, field, value) => {
        const cats = get().categories;
        const next = replaceCategory(cats, catId, (cat) => {
          const action = cat.actions[idx];
          if (action) action[field] = field === "current" ? Number(value) : value;
          return cat;
        });
        if (next === cats) return;
        const action = cats.find((c) => c.id === catId)?.actions?.[idx];
        const serverId = action && !String(action.id || "").startsWith("tmp-") ? action.id : null;
        const newValue = next.find((c) => c.id === catId)?.actions?.[idx]?.[field];
        get().commit(next, {
          apiCall: serverId
            ? () => api.updateAction(serverId, {
                [field]: newValue,
                ...(field === "weight" ? { autoNormalize: true } : {}),
              })
            : undefined,
        });
      },

      incrementAction: (catId, idx, amount) => {
        const action = get().categories.find((c) => c.id === catId)?.actions?.[idx];
        if (!action) return;
        const step = amount ?? action.incrementBy ?? 1;
        const nextVal = Math.max(0, Math.min(action.current + step, action.target));
        const next = replaceCategory(get().categories, catId, (cat) => {
          const a = cat.actions[idx];
          if (a) a.current = nextVal;
          return cat;
        });
        const serverId = action && !String(action.id || "").startsWith("tmp-") ? action.id : null;
        get().commit(next, {
          apiCall: serverId ? () => api.updateAction(serverId, { current: nextVal }) : undefined,
        });
      },

      // Reset daily actions whose window has rolled over (client-side, on load).
      checkDailyResets: () => {
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        const sameDay = (d) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` === todayKey;
        const resets = [];
        const anyDaily = get().categories.some(
          (c) => !c.isRewards && (c.actions || []).some((a) => a.resetType === "daily")
        );
        if (!anyDaily) return;
        const next = get().categories.map((cat) => {
          if (cat.isRewards || !cat.actions) return cat;
          const actions = cat.actions.map((a) => {
            if (a.resetType !== "daily" || a.current === 0) return a;
            const last = a.lastResetAt ? new Date(a.lastResetAt) : null;
            if (last && sameDay(last)) return a;
            resets.push({ id: a.id, server: !String(a.id || "").startsWith("tmp-") });
            return { ...a, current: 0, lastResetAt: today.toISOString() };
          });
          return { ...cat, actions };
        });
        if (resets.length === 0) return;
        get().commit(next);
        for (const r of resets) {
          if (!r.server) continue;
          get().enqueue({ execute: () => api.updateAction(r.id, { current: 0, lastResetAt: today.toISOString() }) });
        }
      },

      updateResult: (catId, idx, field, value) => {
        const cats = get().categories;
        const next = replaceCategory(cats, catId, (cat) => {
          const result = cat.results[idx];
          if (result) result[field] = field === "current" ? Number(value) : value;
          return cat;
        });
        if (next === cats) return;
        const result = cats.find((c) => c.id === catId)?.results?.[idx];
        const serverId = result && !String(result.id || "").startsWith("tmp-") ? result.id : null;
        const newValue = next.find((c) => c.id === catId)?.results?.[idx]?.[field];
        get().commit(next, {
          apiCall: serverId
            ? () => api.updateResult(serverId, { [field]: newValue })
            : undefined,
        });
      },

      incrementResult: (catId, idx, amount) => {
        const result = get().categories.find((c) => c.id === catId)?.results?.[idx];
        if (!result) return;
        const step = amount ?? result.incrementBy ?? 1;
        const nextVal = result.invert
          ? Math.max(0, result.current + step)
          : Math.max(0, Math.min(result.current + step, result.target));
        const next = replaceCategory(get().categories, catId, (cat) => {
          const r = cat.results[idx];
          if (r) r.current = nextVal;
          return cat;
        });
        const serverId = result && !String(result.id || "").startsWith("tmp-") ? result.id : null;
        get().commit(next, {
          apiCall: serverId ? () => api.updateResult(serverId, { current: nextVal }) : undefined,
        });
      },

      addAction: (catId, data) => {
        const cats = get().categories;
        const next = replaceCategory(cats, catId, (cat) => {
          cat.actions.push({ id: uid(), label: data.label, weight: data.weight, current: 0, target: data.target, unit: data.unit || "", incrementBy: data.incrementBy ?? 1, resetType: data.resetType ?? "monthly", actionType: data.actionType || (data.unit ? "amount" : "count") });
          return cat;
        });
        if (next === cats) return;
        get().commit(next, {
          apiCall: () => api.createAction(catId, { label: data.label, weight: data.weight, target: data.target, unit: data.unit, incrementBy: data.incrementBy ?? 1, resetType: data.resetType ?? "monthly", actionType: data.actionType || (data.unit ? "amount" : "count") }),
        });
      },

      deleteAction: (catId, idx) => {
        const cats = get().categories;
        const action = cats.find((c) => c.id === catId)?.actions?.[idx];
        if (!action) return;
        const next = replaceCategory(cats, catId, (cat) => {
          cat.actions.splice(idx, 1);
          return cat;
        });
        const serverId = !String(action.id || "").startsWith("tmp-") ? action.id : null;
        get().commit(next, {
          apiCall: serverId ? () => api.deleteAction(serverId) : undefined,
        });
      },

      addResult: (catId, data) => {
        const cats = get().categories;
        const next = replaceCategory(cats, catId, (cat) => {
          cat.results.push({ id: uid(), label: data.label, current: 0, target: data.target, unit: data.unit || "", resultType: data.resultType || "count", incrementBy: data.incrementBy ?? 1, weight: data.weight ?? 50 });
          return cat;
        });
        if (next === cats) return;
        get().commit(next, {
          apiCall: () => api.createResult(catId, { label: data.label, target: data.target, unit: data.unit }),
        });
      },

      deleteResult: (catId, idx) => {
        const cats = get().categories;
        const result = cats.find((c) => c.id === catId)?.results?.[idx];
        if (!result) return;
        const next = replaceCategory(cats, catId, (cat) => {
          cat.results.splice(idx, 1);
          return cat;
        });
        const serverId = !String(result.id || "").startsWith("tmp-") ? result.id : null;
        get().commit(next, {
          apiCall: serverId ? () => api.deleteResult(serverId) : undefined,
        });
      },

      addCategory: (data) => {
        const cats = get().categories;
        const cat = { id: uid(), name: data.name, dotColor: data.dotColor, expanded: true, isRewards: false, actions: [], results: [], rewards: [] };
        const next = [...cats, cat];
        get().commit(next, {
          apiCall: () => api.createCategory({ name: cat.name, dotColor: cat.dotColor }),
        });
      },

      updateCategory: (catId, data) => {
        const cats = get().categories;
        const next = replaceCategory(cats, catId, (cat) => {
          Object.assign(cat, data);
          return cat;
        });
        const cat = cats.find((c) => c.id === catId);
        if (!cat) return;
        const serverId = !String(cat.id || "").startsWith("tmp-") ? cat.id : null;
        get().commit(next, {
          apiCall: serverId ? () => api.updateCategory(serverId, data) : undefined,
        });
      },

      toggleExpanded: (catId) => {
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === catId ? { ...c, expanded: !c.expanded } : c
          ),
        }));
      },

      deleteCategory: (catId) => {
        const cats = get().categories;
        const cat = cats.find((c) => c.id === catId);
        if (!cat) return;
        const serverId = !String(cat.id || "").startsWith("tmp-") ? cat.id : null;
        const next = cats.filter((c) => c.id !== catId);
        get().commit(next, {
          apiCall: serverId ? () => api.deleteCategory(serverId) : undefined,
        });
      },

      claimReward: (rewardId) => {
        const cats = get().categories;
        let rewardCatId = null;
        for (const cat of cats) {
          const r = (cat.rewards || []).find((x) => x.id === rewardId);
          if (r) {
            if (r.claimed || r.unlocked === false) return; // not eligible locally
            rewardCatId = cat.id;
            break;
          }
        }
        if (!rewardCatId) return;
        const next = replaceCategory(cats, rewardCatId, (cat) => {
          for (const r of cat.rewards || []) if (r.id === rewardId) r.claimed = true;
          return cat;
        });
        const serverId = !String(rewardId || "").startsWith("tmp-") ? rewardId : null;
        get().commit(next, {
          apiCall: serverId ? () => api.claimReward(serverId) : undefined,
        });
      },

      unclaimReward: (rewardId) => {
        const cats = get().categories;
        let rewardCatId = null;
        for (const cat of cats) {
          const r = (cat.rewards || []).find((x) => x.id === rewardId);
          if (r) { rewardCatId = cat.id; break; }
        }
        if (!rewardCatId) return;
        const next = replaceCategory(cats, rewardCatId, (cat) => {
          for (const r of cat.rewards || []) if (r.id === rewardId) r.claimed = false;
          return cat;
        });
        get().commit(next); // client-only reset; no server unclaim endpoint
      },

      addReward: (catId, data) => {
        const cats = get().categories;
        const next = replaceCategory(cats, catId, (cat) => {
          cat.rewards.push({
            id: uid(),
            name: data.name,
            cost: data.cost,
            threshold: data.cost,
            price: data.price ?? null,
            thresholdType: data.thresholdType || "score",
            period: data.period || "monthly",
            linkedActionId: data.linkedActionId || null,
            linkedResultId: data.linkedResultId || null,
            linkedPercent: data.linkedPercent ?? null,
            claimed: false,
          });
          return cat;
        });
        if (next === cats) return;
        get().commit(next, {
          apiCall: () => api.createReward(catId, data),
        });
      },

      updateReward: (catId, rewardId, data) => {
        const cats = get().categories;
        const next = replaceCategory(cats, catId, (cat) => {
          for (const r of cat.rewards || []) {
            if (r.id === rewardId) Object.assign(r, data);
          }
          return cat;
        });
        if (next === cats) return;
        const serverId = !String(rewardId || "").startsWith("tmp-") ? rewardId : null;
        get().commit(next, {
          apiCall: serverId ? () => api.updateReward(serverId, data) : undefined,
        });
      },

      deleteReward: (catId, rewardId) => {
        const cats = get().categories;
        const next = replaceCategory(cats, catId, (cat) => {
          cat.rewards = (cat.rewards || []).filter((r) => r.id !== rewardId);
          return cat;
        });
        if (next === cats) return;
        const serverId = !String(rewardId || "").startsWith("tmp-") ? rewardId : null;
        get().commit(next, {
          apiCall: serverId ? () => api.deleteReward(serverId) : undefined,
        });
      },

      moveCategory: (fromIndex, toIndex) => {
        const cats = [...get().categories];
        if (fromIndex < 0 || fromIndex >= cats.length || toIndex < 0 || toIndex >= cats.length) return;
        const [moved] = cats.splice(fromIndex, 1);
        cats.splice(toIndex, 0, moved);
        const ids = cats.filter((c) => !String(c.id || "").startsWith("tmp-")).map((c) => c.id);
        get().commit(cats, {
          apiCall: get().isGuest ? undefined : () => api.reorderCategories(ids),
        });
      },

      resetAll: () => {
        get().pushUndo();
        const reset = get().categories.map((cat) => ({
          ...cat,
          actions: (cat.actions || []).map((a) => ({ ...a, current: 0 })),
          results: (cat.results || []).map((r) => ({ ...r, current: 0 })),
          rewards: (cat.rewards || []).map((r) => ({ ...r, claimed: false })),
        }));
        set({ categories: reset });
        get().derive();
      },

      // Copy the month before the one currently selected into the selected
      // month, with all progress (current) reset to 0 for a fresh start.
      // Works when viewing any month (live or past). Returns true when
      // something was copied, false when there is nothing to copy.
      copyLastMonth: async () => {
        const s = get();
        const targetKey = s.selectedMonth || monthKeyOf();
        const liveKey = monthKeyOf();
        const srcKey = prevMonthKey(targetKey);

        // Source is ONLY the actual month before the target. If that month has no
        // saved snapshot, there is nothing to copy — surface that to the user
        // rather than silently substituting the live/current goals.
        let source = null;
        if (srcKey) {
          source = s.monthlySnapshots[srcKey];
          if (!source && !get().isGuest && (s.serverSnapshotMonths || []).includes(srcKey)) {
            try {
              const { data } = await api.snapshot(srcKey);
              source = data;
            } catch {
              source = null;
            }
          }
        }

        if (!Array.isArray(source) || source.length === 0) return false;

        // Clone the structure but reset progress for a fresh month.
        const copied = ensureRewardTiers(deepClone(source).map((cat) => ({
          ...cat,
          expanded: true,
          actions: (cat.actions || []).map((a) => ({ ...a, current: 0 })),
          results: (cat.results || []).map((r) => ({ ...r, current: 0 })),
          rewards: (cat.rewards || []).map((r) => ({ ...r, claimed: false })),
        })));

        // Write into the selected month, staying on it (a past month keeps
        // history/viewing state, the live month returns to live editing).
        set((st) => ({
          categories: copied,
          viewingHistory: targetKey !== liveKey,
          selectedMonth: targetKey,
          monthlySnapshots: { ...st.monthlySnapshots, [targetKey]: deepClone(copied) },
        }));
        const dashboard = calculateDashboardState(copied, dateOfMonthKey(targetKey), 0);
        set({ dashboard, bootstrapped: true, lastSyncedAt: new Date().toISOString() });
        get().pushUndo();

        if (!get().isGuest) {
          api.saveSnapshot(targetKey, deepClone(copied)).catch(() => {});
          await get().syncToAccount();
        }
        return true;
      },

      // Remove every category/goal/task from the month currently on screen
      // (the selected month — whether that's the live month or a past one).
      emptyMonth: () => {
        get().pushUndo();
        const targetKey = get().selectedMonth || monthKeyOf();
        const liveKey = monthKeyOf();
        const isLive = targetKey === liveKey;
        set((st) => ({
          categories: [],
          selectedMonth: targetKey,
          viewingHistory: isLive ? false : st.viewingHistory,
          liveCategories: isLive ? null : st.liveCategories,
          monthOffset: isLive ? 0 : st.monthOffset,
          monthlySnapshots: { ...st.monthlySnapshots, [targetKey]: [] },
        }));
        const dashboard = calculateDashboardState([], dateOfMonthKey(targetKey), 0);
        set({ dashboard, bootstrapped: true, lastSyncedAt: new Date().toISOString() });
        if (!get().isGuest) {
          api.saveSnapshot(targetKey, []).catch(() => {});
        }
        if (isLive) get().captureSnapshot();
      },
    }),
{
        name: GUEST_KEY,
        partialize: (s) => ({
          categories: s.categories,
          user: s.user,
          isGuest: s.isGuest,
          sessionStarted: s.sessionStarted,
          monthOffset: s.monthOffset,
          selectedMonth: s.selectedMonth,
          viewingHistory: s.viewingHistory,
          liveCategories: s.liveCategories,
          monthlySnapshots: s.monthlySnapshots,
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;
          state.bootstrap();
        },
      }
    )
);

// Mirror every categories change into the logged-in user's local profile so
// their stats survive logout and future visits on this device.
useGoalsStore.subscribe((state, prev) => {
  if (state.categories !== prev.categories && state.user?.email && !state.isGuest) {
    const map = readProfiles();
    const slot = map[state.user.email];
    if (slot) {
      map[state.user.email] = { ...slot, categories: deepClone(state.categories) };
      writeProfiles(map);
    }
  }
});
