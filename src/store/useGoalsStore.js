import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { categories as seedCategories, generateRewardTiers } from "../data/goals";
import { calculateDashboardState, aggregateResultsPct } from "../lib/score";
import { api, setAccessToken, getAccessToken } from "../lib/api";
import { generateGuestLogs } from "../lib/guestLogs";
import {
  setIdentityScope,
  restoreIdentityScope,
  migrateLegacyBlob,
  identityStorage,
  setStoredRefreshToken,
  getStoredRefreshToken,
  clearStoredRefreshToken,
} from "../lib/storageScope";

const GUEST_KEY = "august-goals-guest-v2";
const PROFILES_KEY = "august-goals-profiles";

// Decide which namespace to read before the store is constructed. The legacy
// unscoped blob is folded into the identity it really belonged to, so the
// signed-in user's own state survives this change while every other account
// starts clean.
const bootIdentity = migrateLegacyBlob(GUEST_KEY) || restoreIdentityScope();
setIdentityScope(bootIdentity);

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

// The refresh token is persisted per identity outside the state blob. The server
// sends it in auth responses so session restore no longer depends on the
// cross-site httpOnly cookie, which browsers drop when the app and API are on
// different sites.
const saveRefreshToken = setStoredRefreshToken;
const readRefreshToken = getStoredRefreshToken;
const clearRefreshToken = clearStoredRefreshToken;

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
// Device's local calendar-date key ("YYYY-M-D"). Purely local — never UTC.
function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
// Device's local midnight as a naive (zone-less) ISO, so re-parsing with
// `new Date(...)` always stays on the same LOCAL day even if the device
// clock/timezone changes by an hour.
function localMidnightISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00`;
}
// Padded "YYYY-MM-DD" key for a Date's local calendar day (sortable; used for
// daily history snapshots).
function paddedDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
// Padded "YYYY-MM-DD" key for a progress log, preferring the server's own
// `date` so the day matches what the server recorded.
function paddedDayKeyOfLog(l) {
  if (l.date) {
    const d = new Date(l.date);
    if (!Number.isNaN(d.getTime())) return paddedDayKey(d);
  }
  if (l.year && l.month && l.dayOfMonth) {
    return `${l.year}-${String(l.month).padStart(2, "0")}-${String(l.dayOfMonth).padStart(2, "0")}`;
  }
  return null;
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

// Client seed uses `color` hex; normalize to `dotColor` token and add fields
// components/schema expect. `isRewards` defaults to false.
const HEX_TO_DOT = {
  "#6df5e3": "turquoise",
  "#2dd4bf": "turquoise",
  "#ffffff": "white",
  "#4d8dff": "blue",
  "#b44cff": "purple",
  "#63e94f": "green",
  "#ff4d8d": "pink",
  "#ff6b35": "orange",
  "#ffe14d": "yellow",
  "#ff3b47": "red",
};

// Default cards get a lively color each; a card is only recolored while it is
// still on the old plain turquoise/white defaults, so manual picks stay.
const DEFAULT_CAT_COLORS = {
  finance: "turquoise",
  business: "blue",
  faith: "purple",
  health: "green",
  learning: "pink",
  social: "orange",
  family: "yellow",
  discipline: "red",
  rewards: "turquoise",
};

// Older imported data omitted resetType on most actions, so those read back as
// undefined. Defaulting them to "monthly" is what makes "monthly stays until
// the month ends" hold: an explicit value, not a missing one.
function normalizeResetTypes(cats) {
  let changed = false;
  const next = cats.map((c) => {
    if (c.isRewards || !c.actions) return c;
    let touched = false;
    const actions = c.actions.map((a) => {
      if (a.resetType) return a;
      touched = true;
      return { ...a, resetType: "monthly" };
    });
    if (!touched) return c;
    changed = true;
    return { ...c, actions };
  });
  return changed ? next : cats;
}

function migrateDefaultColors(cats) {
  let changed = false;
  const next = cats.map((c) => {
    const want = DEFAULT_CAT_COLORS[c.id];
    if (!want) return c;
    const isDefaultish = c.dotColor === "turquoise" || c.dotColor === "white";
    if (!isDefaultish || want === c.dotColor) return c;
    changed = true;
    return { ...c, dotColor: want };
  });
  return changed ? next : cats;
}

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
  // True while a rehydrated session is trading its refresh cookie for a fresh
  // access token. The dashboard waits on this so it never renders data it
  // cannot save.
  sessionRestoring: false,
  loading: false,
  error: null,
  lastSyncedAt: null,
  progressLogs: [],
  undoStack: [],
  pendingMutations: [],
  flushing: false,
  editMode: false,
  monthOffset: 0,
  selectedMonth: localMonthKey(),
  viewingHistory: false,
  liveCategories: null,
  monthlySnapshots: {},
  serverSnapshotMonths: [],
  // Archived day-of-checklist history, keyed by "YYYY-MM-DD". Grows on a daily
  // rollover, so a refresh or next-day visit sees the previous day as history.
  dailySnapshots: {},
  // Padded "YYYY-MM-DD" of the last day checkDailyResets() processed.
  lastDayKey: null,
  // "YYYY-MM" of the last month checkMonthRollover() started. When the device
  // crosses into a new month, the finished month is archived and the live
  // month starts at zero.
  lastMonthKey: null,
});

export const useGoalsStore = create(
  persist(
    (set, get) => ({
      ...emptyState(),
      categories: seedClone(),

      derive() {
        const cats = get().categories;
        const migrated = migrateDefaultColors(cats);
        if (migrated !== cats) set({ categories: migrated });
        const dashboard = calculateDashboardState(migrated, new Date(), get().monthOffset);
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

      switchDay(dayKey) {
        const data = get().dailySnapshots[dayKey];
        if (!Array.isArray(data) || data.length === 0) return;
        const [y, m, d] = String(dayKey || "").split("-").map(Number);
        if (!y || !m) return;
        const liveCategories = get().liveCategories || deepClone(get().categories);
        const dashboard = calculateDashboardState(data, new Date(y, m - 1, d || 1), 0);
        set({
          selectedMonth: monthKeyOf(new Date(y, m - 1, 1)),
          viewingHistory: true,
          liveCategories,
          categories: deepClone(data),
          dashboard,
          bootstrapped: true,
        });
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
        categories = normalizeResetTypes(ensureRewardTiers(categories));
        // Only seed the synthetic past-month history when nothing has ever been
        // recorded. Recorded days stay frozen — never regenerated after this.
        if ((get().progressLogs || []).length === 0) {
          set({ progressLogs: generateGuestLogs() });
        }
        const dashboard = calculateDashboardState(categories, new Date(), get().monthOffset);
        set({ categories, dashboard, bootstrapped: true });
        // Server-backed sessions roll over in adoptServerSession(), once the
        // server's own data has loaded, so the archive is the real end state.
        if (!get().isServerBacked) get().checkMonthRollover();
        get().ensureDailyLog(get().categories, get().dashboard);
      },

      startGuest: () => {
        if ((get().progressLogs || []).length === 0) {
          set({ progressLogs: generateGuestLogs() });
        }
        set({ user: null, isGuest: true, sessionStarted: true });
        get().derive();
        get().ensureDailyLog();
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
        if ((get().progressLogs || []).length === 0) {
          set({ progressLogs: generateGuestLogs() });
        }
        set({
          user: { email, name },
          isGuest: false,
          sessionStarted: true,
          error: null,
          lastSyncedAt: new Date().toISOString(),
        });
        get().derive();
        get().ensureDailyLog();
      },

      // Pull this account's data down from the server and make it the live
      // state. The server is the source of truth once a session is server-backed;
      // the local profile slot is only a cache for offline/guest use.
      adoptServerSession: async (accessToken, user) => {
        setAccessToken(accessToken);
        // Switch the persist namespace BEFORE any state is written, otherwise
        // the first set() after login lands in whichever blob was loaded at boot
        // and the next reload rehydrates the previous account's data.
        setIdentityScope(user.email);

        const [dashboard, progress] = await Promise.all([
          api.dashboard(),
          api.progress({}).catch(() => ({ logs: [] })),
        ]);
        // The server is the source of truth for history. Reusing whatever was
        // cached in the browser is what let a new account draw a chart built
        // from someone else's days.
        // The server sends `date` (an ISO timestamp); the charts filter and
        // group on `dateKey` ("YYYY-MM-DD"). Dropping it here meant every
        // server-backed log failed the chart's month filter, so a signed-in
        // user saw an empty chart while guest mode worked.
        const logs = (progress?.logs || []).map((l) => ({
          id: l.id,
          year: l.year,
          month: l.month,
          dayOfMonth: l.dayOfMonth,
          qualityScore: l.qualityScore,
          expectedScore: l.expectedScore,
          resultsScore: l.resultsScore,
          dateKey: l.dateKey || paddedDayKeyOfLog(l),
        }));

        set({
          user: { email: user.email, name: user.name },
          isGuest: false,
          isServerBacked: true,
          sessionStarted: true,
          error: null,
          categories: normalizeResetTypes(
            ensureRewardTiers(deepClone(dashboard.categories || []))
          ),
          progressLogs: logs,
          // Fresh session on another account must not inherit history.
          viewingHistory: false,
          // The live month, not null: the dashboard reads selectedMonth to
          // decide what to render, so null left the month picker and every
          // month-scoped panel with nothing to work from.
          selectedMonth: localMonthKey(),
          liveCategories: null,
          undoStack: [],
          pendingMutations: [],
          lastSyncedAt: new Date().toISOString(),
        });
        get().persistLocalProfile();
        const d = calculateDashboardState(get().categories, new Date(), get().monthOffset);
        set({ dashboard: d, bootstrapped: true });
        // A guest bootstrap has already stamped lastMonthKey with the current
        // month before login, so trust the server's own history here instead.
        get().checkMonthRollover({ ignoreStored: true });
        get().derive();
        get().ensureDailyLog(get().categories, get().dashboard);
      },

      register: async (credentials) => {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        const name = String(credentials?.name || "").trim() || "User";
        if (!email || !/.+@.+\..+/.test(email)) {
          set({ error: "Enter a valid email address", loading: false });
          throw new Error("Enter a valid email address");
        }
        if (password.length < 4) {
          set({ error: "Password must be at least 4 characters", loading: false });
          throw new Error("Password must be at least 4 characters");
        }
        try {
          const { accessToken, user, refreshToken } = await api.register({ email, password, name });
          await get().adoptServerSession(accessToken, user);
          saveRefreshToken(refreshToken);
          return;
        } catch (err) {
          // The server already knows this email, or is unreachable. A local-only
          // account is still a valid destination, so fall through instead of
          // hard-failing — this is a guest-first app that must work offline.
          if (err?.status === 409) {
            const msg = "An account with this email already exists. Log in instead.";
            set({ error: msg, loading: false });
            throw new Error(msg);
          }
        }
        const map = readProfiles();
        if (map[email]) {
          const msg = "An account with this email already exists. Log in instead.";
          set({ error: msg, loading: false });
          throw new Error(msg);
        }
        const passHash = await hashPassword(password);
        map[email] = { name, passHash, categories: seedClone() };
        writeProfiles(map);
        get().applyLocalProfile(email, map[email]);
      },

      login: async (credentials) => {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) {
          set({ error: "Enter your email and password", loading: false });
          throw new Error("Enter your email and password");
        }
        try {
          const { accessToken, user, refreshToken } = await api.login({ email, password });
          await get().adoptServerSession(accessToken, user);
          saveRefreshToken(refreshToken);
          return;
        } catch (err) {
          // The server gave a definitive answer — never let the local cache
          // contradict it. Falling through here used to turn a rate-limit (429)
          // or an unreachable API into a misleading "Incorrect password".
          if (err?.status) {
            const msg =
              err.status === 429
                ? "Too many attempts. Wait 15 minutes, then try again."
                : err.status === 401 || err.status === 400
                  ? "Incorrect email or password."
                  : err.message || "Could not reach the server.";
            set({ error: msg, loading: false });
            throw new Error(msg);
          }
          // No response at all (API down, offline). Fall back to a local
          // profile so the guest-first app still works.
        }
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

      // Restore a server session from the refresh cookie so a reload does not
      // bounce the user back to the auth screen.
      resumeServerSession: async () => {
        try {
          const { accessToken, user, refreshToken } = await api.refresh(readRefreshToken());
          await get().adoptServerSession(accessToken, user);
          saveRefreshToken(refreshToken);
          return true;
        } catch {
          setAccessToken(null);
          return false;
        }
      },

      logout: () => {
        if (get().isServerBacked) api.logout(readRefreshToken()).catch(() => {});
        // Clear while the scope still points at this account (before user:null
        // switches the identity scope back to guest).
        clearRefreshToken();
        setAccessToken(null);
        get().persistLocalProfile();
        set({
          isServerBacked: false,
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

      // Called once on boot. A page reload rehydrates a logged-in state from
      // localStorage, but the access token lived only in a module variable, so
      // it came back null: the app looked signed in and every write 401'd. The
      // refresh cookie is still valid, so mint a new access token and, if that
      // fails, fall back to the honest state instead of pretending to be synced.
      restoreSession: async () => {
        const s = get();
        if (s.isGuest || !s.user?.email) return false;
        if (getAccessToken()) return true;
        set({ sessionRestoring: true });
        try {
          const { accessToken, user, refreshToken } = await api.refresh(readRefreshToken());
          setAccessToken(accessToken);
          saveRefreshToken(refreshToken);
          const [dashboard, progress] = await Promise.all([
            api.dashboard(),
            api.progress({}).catch(() => ({ logs: [] })),
          ]);
          const logs = (progress?.logs || []).map((l) => ({
            id: l.id,
            year: l.year,
            month: l.month,
            dayOfMonth: l.dayOfMonth,
            qualityScore: l.qualityScore,
            expectedScore: l.expectedScore,
            resultsScore: l.resultsScore,
            dateKey: l.dateKey || paddedDayKeyOfLog(l),
          }));
          set({
            user: { email: user.email, name: user.name },
            isGuest: false,
            isServerBacked: true,
            sessionStarted: true,
            error: null,
            categories: normalizeResetTypes(
              ensureRewardTiers(deepClone(dashboard.categories || []))
            ),
            progressLogs: logs,
            viewingHistory: false,
            selectedMonth: s.selectedMonth || localMonthKey(),
            liveCategories: null,
            pendingMutations: [],
            lastSyncedAt: new Date().toISOString(),
          });
          get().checkMonthRollover();
          get().derive();
          get().ensureDailyLog(get().categories, get().dashboard);
          set({ sessionRestoring: false });
          return true;
        } catch (err) {
          // Refresh rejected: the token is gone or expired. Only forget it when
          // the server actually rejected it, not on a transient network error.
          //
          // The message has to distinguish those two cases. A dead API (the
          // stack was down, the tunnel URL rotated away) is not an expired
          // session, and telling the user to log in again sent them off to
          // reset a password that was always fine. No status means the request
          // never reached the server at all.
          const rejected = err?.status === 401;
          if (rejected) clearRefreshToken();
          set({
            isServerBacked: false,
            isGuest: true,
            user: null,
            sessionStarted: false,
            sessionRestoring: false,
            error: rejected
              ? "Session expired. Log in again to save changes."
              : "Can't reach the server. Your changes are saved on this device — try again when it's back.",
          });
          get().derive();
          return false;
        }
      },

      syncToAccount: async (mode = "merge") => {
        if (get().isGuest) throw new Error("Not authenticated");
        const payload = { mode, categories: get().categories };
        const { dashboard } = await api.sync(payload);
        set({ categories: ensureRewardTiers(deepClone(dashboard.categories)), lastSyncedAt: new Date().toISOString() });
        const d = calculateDashboardState(get().categories, new Date(), get().monthOffset);
        set({ dashboard: d, bootstrapped: true });
        get().ensureDailyLog(get().categories, d);
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
          get().recordDailyLog(nextCategories, dashboard);
        };
        get().pushUndo();
        act();
        return nextCategories;
      },

      // Record today's real execution + results scores into the daily log so
      // the chart shows true day-by-day stats (each day frozen at what it was).
      recordDailyLog: (categories, dashboard) => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d = now.getDate();
        const resultsScore = Math.round(aggregateResultsPct(categories || get().categories) * 10) / 10;
        const qualityScore = dashboard?.stats?.qualityPercent ?? get().dashboard?.stats?.qualityPercent ?? 0;
        const daysInMonth = dashboard?.meta?.daysInMonth
          ?? get().dashboard?.meta?.daysInMonth
          ?? 30;
        const expectedScore = Math.round(((d / daysInMonth) * 100) * 10) / 10;
        const logs = (get().progressLogs || []).filter(
          (l) => !(l.year === y && l.month === m && l.dayOfMonth === d)
        );
        set({
          progressLogs: [
            ...logs,
            { year: y, month: m, dayOfMonth: d, qualityScore, expectedScore, resultsScore },
          ],
        });
      },

      // Make sure today is represented in the daily log. It only EVER inserts
      // or refreshes TODAY's entry — every older day is left untouched, so a
      // day's score freezes at whatever it was before 00:00.
      ensureDailyLog: (categories = get().categories, dashboard = get().dashboard) => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d = now.getDate();
        const logs = get().progressLogs || [];
        if (logs.some((l) => l.year === y && l.month === m && l.dayOfMonth === d)) return;
        const resultsScore = Math.round(aggregateResultsPct(categories) * 10) / 10;
        const qualityScore = dashboard?.stats?.qualityPercent ?? 0;
        const daysInMonth = dashboard?.meta?.daysInMonth ?? 30;
        const expectedScore = Math.round(((d / daysInMonth) * 100) * 10) / 10;
        set({
          progressLogs: [
            ...logs,
            { year: y, month: m, dayOfMonth: d, qualityScore, expectedScore, resultsScore },
          ],
        });
      },

      // ── Optimistic + queue mutation ─────────────────────
      enqueue: (entry) => {
        set((s) => ({
          pendingMutations: [...s.pendingMutations, { id: uid(), timestamp: Date.now(), ...entry }],
        }));
        if (!get().isGuest) get().flush();
      },

      // Actually run the queued mutations. This used to just empty the queue —
      // a leftover from the frontend-only build — so every edit looked like it
      // saved and then came back from the server at its old value on the next
      // load. Now each entry's `execute` is really called, and anything that
      // fails stays queued for `retryAll` instead of being silently dropped.
      //
      // The queue is drained from the head rather than from a snapshot taken
      // before the loop. A snapshot missed anything queued while an execute was
      // in flight: flush was already running, so the new entry's own flush call
      // returned early, and nothing ever came back for it. Dragging two rows in
      // quick succession is enough to hit that, and the second move was lost.
      flush: async () => {
        if (get().flushing) return;
        set({ flushing: true });
        try {
          for (;;) {
            const next = get().pendingMutations[0];
            if (!next) break;
            const drop = () => set((s) => ({ pendingMutations: s.pendingMutations.filter((x) => x.id !== next.id) }));
            if (typeof next.execute !== "function") { drop(); continue; }
            try {
              await next.execute();
              // Only drop the ones that actually made it.
              drop();
            } catch (err) {
              // A server-backed session needs an access token. A 401/403 means
              // the session is gone, not that the edit is bad — stop and surface
              // it rather than retrying into a wall.
              if (err?.status === 401 || err?.status === 403) {
                set({ error: "Session expired. Please log in again." });
                break;
              }
              // Leave it queued: offline or a transient 5xx should not lose data.
              // Stop here so a failing head cannot spin the loop; the next
              // enqueue (or retryAll) starts a fresh pass.
              break;
            }
          }
        } finally {
          set({ flushing: false });
        }
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
        const safeTarget = action.target > 0 ? action.target : 1;
        const nextVal = Math.max(0, Math.min(action.current + step, safeTarget));
        const next = replaceCategory(get().categories, catId, (cat) => {
          const a = cat.actions[idx];
          if (a) a.current = nextVal;
          return cat;
        });
        const serverId = action && !String(action.id || "").startsWith("tmp-") ? action.id : null;
        // A daily action's first increment of the day must also stamp its
        // window. Without this, lastResetAt stayed at the previous run's date,
        // so the very next load saw a stale window and reset the edit away —
        // which looked like the first tap of the day was being rejected.
        const patch = { current: nextVal };
        if (action.resetType === "daily") patch.lastResetAt = localMidnightISO(new Date());
        get().commit(next, {
          apiCall: serverId ? () => api.updateAction(serverId, patch) : undefined,
        });
      },

      // Reset daily actions whose window has rolled over (client-side, on load).
      // "Today" always means the DEVICE's local calendar day, so the roll-over
      // happens at device midnight 00:00 — never early (e.g. a UTC flip or a
      // device clock shifted by an hour).
      checkDailyResets: () => {
        const today = new Date();
        const todayKey = paddedDayKey(today);
        const sameDay = (d) => d && localDayKey(d) === localDayKey(today);

        // Day rollover: archive the finished day's checklist under its own
        // "YYYY-MM-DD" history key BEFORE the daily reset empties it.
        const prevKey = get().lastDayKey;
        if (prevKey && prevKey !== todayKey && !get().dailySnapshots[prevKey]) {
          set((st) => ({
            dailySnapshots: { ...st.dailySnapshots, [prevKey]: deepClone(get().categories) },
          }));
        }
        set({ lastDayKey: todayKey });

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
            return { ...a, current: 0, lastResetAt: localMidnightISO(today) };
          });
          return { ...cat, actions };
        });
        if (resets.length === 0) return;
        get().commit(next);
        for (const r of resets) {
          if (!r.server) continue;
          get().enqueue({ execute: () => api.updateAction(r.id, { current: 0, lastResetAt: localMidnightISO(today) }) });
        }
      },

      // Month rollover (client-side, on load like the daily one). When the
      // device's local calendar crosses into a new month, the finished month is
      // archived to history and the new live month starts at zero: every task,
      // result and reward claim resets, but the goals structure carries over.
      // "Today" is the DEVICE's month, so this never fires early on a UTC flip.
      checkMonthRollover: (opts = {}) => {
        const s = get();
        const currentKey = localMonthKey();

        const liveSrc = s.liveCategories || s.categories;
        const hasProgress = (liveSrc || []).some(
          (c) =>
            (c.actions || []).some((a) => a.current > 0) ||
            (c.results || []).some((r) => r.current > 0) ||
            (c.rewards || []).some((r) => r.claimed)
        );

        // Which month does the live data belong to? Normally the recorded
        // lastMonthKey, but when there is none — the first run after this
        // shipped, or a fresh login where bootstrap() already stamped the
        // current month before any account data had loaded — infer it from the
        // newest month with recorded days. The live month's own snapshot is
        // written on every edit, so only the log history can answer this.
        let prevKey = opts.ignoreStored ? null : s.lastMonthKey;
        if (!prevKey) {
          const logMonths = [];
          for (const l of s.progressLogs || []) {
            if (l?.year && l?.month) {
              logMonths.push(`${l.year}-${String(l.month).padStart(2, "0")}`);
            }
          }
          logMonths.sort();
          const latest = logMonths.length ? logMonths[logMonths.length - 1] : null;
          // Only roll over when there is progress to clear and the newest
          // recorded day belongs to an earlier month. Requiring progress means
          // a second pass over an already-zeroed month is a no-op, so a reload
          // can never overwrite the finished month's archive with blank data.
          prevKey = hasProgress && latest && latest < currentKey ? latest : currentKey;
        }

        if (!prevKey || prevKey >= currentKey) {
          if (s.lastMonthKey !== currentKey) set({ lastMonthKey: currentKey });
          return;
        }

        // A server-backed month must reset atomically. The per-row queue used to
        // stop at the first rejected row and leave the rest of the month sitting
        // at last month's numbers, so the server archives, clears and re-snapshots
        // the whole month in one transaction and hands back the fresh one.
        if (get().isServerBacked) {
          // Claim the month now so a reload mid-request cannot start a second
          // pass; put it back on failure so the rollover retries on next load.
          set({ lastMonthKey: currentKey });
          get().persistLocalProfile();
          api
            .rollover(prevKey, currentKey)
            .then((serverDashboard) => {
              const categories = normalizeResetTypes(
                ensureRewardTiers(deepClone(serverDashboard.categories || []))
              );
              const dashboard = calculateDashboardState(categories, new Date(), 0);
              set({
                categories,
                monthlySnapshots: { ...get().monthlySnapshots, [currentKey]: deepClone(categories) },
                liveCategories: null,
                viewingHistory: false,
                selectedMonth: currentKey,
                monthOffset: 0,
                lastMonthKey: currentKey,
                dashboard,
                bootstrapped: true,
                lastSyncedAt: new Date().toISOString(),
              });
              get().persistLocalProfile();
              get().derive();
              // Correct today's log, which was written against the un-cleared
              // month before this resolved.
              get().ensureDailyLog(categories, dashboard);
            })
            .catch(() => {
              set({ lastMonthKey: prevKey });
              get().persistLocalProfile();
            });
          return;
        }

        // Guest/local month: reset in place from the same goals.
        const live = deepClone(s.liveCategories || s.categories);
        const next = live.map((cat) => ({
          ...cat,
          expanded: true,
          actions: (cat.actions || []).map((a) =>
            a.current ? { ...a, current: 0, lastResetAt: localMidnightISO(new Date()) } : a
          ),
          results: (cat.results || []).map((r) => (r.current ? { ...r, current: 0 } : r)),
          rewards: (cat.rewards || []).map((r) =>
            r.claimed ? { ...r, claimed: false, claimedAt: null } : r
          ),
        }));

        set((st) => ({
          monthlySnapshots: {
            ...st.monthlySnapshots,
            [prevKey]: deepClone(live),
            [currentKey]: deepClone(next),
          },
          categories: next,
          liveCategories: null,
          viewingHistory: false,
          selectedMonth: currentKey,
          lastMonthKey: currentKey,
          monthOffset: 0,
        }));
        const dashboard = calculateDashboardState(next, new Date(), 0);
        set({ dashboard, bootstrapped: true, lastSyncedAt: new Date().toISOString() });
        get().persistLocalProfile();
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
        const safeTarget = result && result.target > 0 ? result.target : 1;
        const nextVal = result.invert
          ? Math.max(0, result.current + step)
          : Math.max(0, Math.min(result.current + step, safeTarget));
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

      // Drag-reorder the tasks inside one category. Mirrors moveCategory: the
      // local array moves immediately, then the new order is written as a single
      // call so a reload cannot land on a half-applied order. sortOrder is kept
      // in step locally too, because the category payload is the only place the
      // client learns an action's position.
      moveAction: (categoryId, fromIndex, toIndex) => {
        const cat = get().categories.find((c) => c.id === categoryId);
        if (!cat) return;
        const items = [...(cat.actions || [])];
        if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return;
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        const numbered = items.map((a, i) => ({ ...a, sortOrder: i }));
        const ids = numbered.filter((a) => !String(a.id || "").startsWith("tmp-")).map((a) => a.id);
        get().commit(
          get().categories.map((c) => (c.id === categoryId ? { ...c, actions: numbered } : c)),
          {
            apiCall: get().isGuest ? undefined : () => api.reorderActions(categoryId, ids),
          },
        );
      },

      moveResult: (categoryId, fromIndex, toIndex) => {
        const cat = get().categories.find((c) => c.id === categoryId);
        if (!cat) return;
        const items = [...(cat.results || [])];
        if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return;
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        const numbered = items.map((r, i) => ({ ...r, sortOrder: i }));
        const ids = numbered.filter((r) => !String(r.id || "").startsWith("tmp-")).map((r) => r.id);
        get().commit(
          get().categories.map((c) => (c.id === categoryId ? { ...c, results: numbered } : c)),
          {
            apiCall: get().isGuest ? undefined : () => api.reorderResults(categoryId, ids),
          },
        );
      },

      // Zero only what a reset is actually allowed to zero. A monthly counter
      // is the user's month-to-date progress and must survive a stray reset,
      // so this respects each action's own resetType instead of flattening
      // everything the way it used to.
      resetAll: () => {
        get().pushUndo();
        const resets = [];
        const reset = get().categories.map((cat) => ({
          ...cat,
          actions: (cat.actions || []).map((a) => {
            if (a.current === 0) return a;
            if (a.resetType && a.resetType !== "monthly") {
              resets.push({ id: a.id, server: !String(a.id || "").startsWith("tmp-") });
              return { ...a, current: 0 };
            }
            return a;
          }),
          results: (cat.results || []).map((r) => ({ ...r, current: 0 })),
          rewards: (cat.rewards || []).map((r) => ({ ...r, claimed: false })),
        }));
        set({ categories: reset });
        get().derive();
        for (const r of resets) {
          if (!r.server) continue;
          get().enqueue({ execute: () => api.updateAction(r.id, { current: 0, allowZeroed: true }) });
        }
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

        // This is the dangerous one: it zeroes every action in the target
        // month. Copying into a PAST month is safe history work, but copying
        // into the live month mid-progress would wipe the current month, which
        // is exactly what happened. Refuse rather than destroy, and let the
        // caller show the reason.
        if (targetKey === liveKey) {
          const liveProgress = get().categories.some((c) =>
            (c.actions || []).some((a) => a.current > 0) ||
            (c.results || []).some((r) => r.current > 0)
          );
          if (liveProgress) {
            set({ error: "This month already has progress. Reset it from that month's view instead." });
            return false;
          }
        }

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
        // Namespaced per identity. Without this every account on the device
        // shared one blob, which is how a brand new user could see the previous
        // user's chart, snapshots and daily history.
        storage: createJSONStorage(() => identityStorage),
        name: GUEST_KEY,
        partialize: (s) => ({
          categories: s.categories,
          progressLogs: s.progressLogs,
          user: s.user,
          isGuest: s.isGuest,
          isServerBacked: s.isServerBacked,
          sessionStarted: s.sessionStarted,
          monthOffset: s.monthOffset,
          selectedMonth: s.selectedMonth,
          viewingHistory: s.viewingHistory,
          liveCategories: s.liveCategories,
          monthlySnapshots: s.monthlySnapshots,
          dailySnapshots: s.dailySnapshots,
          lastDayKey: s.lastDayKey,
          lastMonthKey: s.lastMonthKey,
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
  const identity = state.isGuest ? null : state.user?.email || null;
  if (identity !== (prev.isGuest ? null : prev.user?.email || null)) {
    setIdentityScope(identity);
  }
  if (state.categories !== prev.categories && state.user?.email && !state.isGuest) {
    const map = readProfiles();
    const slot = map[state.user.email];
    if (slot) {
      map[state.user.email] = { ...slot, categories: deepClone(state.categories) };
      writeProfiles(map);
    }
  }
});
