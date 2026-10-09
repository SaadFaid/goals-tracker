// The Published bundle used to freeze the API base at build time. Quick-tunnel
// hostnames change on every restart, so after a rotation the site talked to a
// dead URL until a fresh build shipped — and browsers kept the old bundle long
// enough that "offline" stuck around long after the rebuild. The runtime config
// file (public/api-config.json, rewritten by deploy/goals-stack.sh) is now the
// primary source, so every reload and every reconnect re-resolves the current
// tunnel. A network failure also drops the cache so the reconnect loop picks up
// a repointed config instead of retrying a dead host forever.
const BAKED_API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

let apiBase = null;
let resolvingBase = null;

async function resolveApiBase() {
  if (apiBase) return apiBase;
  if (import.meta.env.DEV) {
    apiBase = BAKED_API_BASE;
    return apiBase;
  }
  if (resolvingBase) return resolvingBase;
  resolvingBase = (async () => {
    try {
      const url = `${location.origin}${import.meta.env.BASE_URL}api-config.json?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const cfg = await res.json();
        const base = cfg?.apiBase;
        if (typeof base === "string" && base) {
          apiBase = base.replace(/\/+$/, "");
          return apiBase;
        }
      }
    } catch {
      // config unreachable (e.g. served under a different origin); fall back
    }
    apiBase = BAKED_API_BASE;
    return apiBase;
  })();
  return resolvingBase;
}

// A request that dies on the network must not leave the next retry pinned to
// the same base. The tunnel may have been repointed; drop the cache so the
// reconnect loop re-reads api-config.json.
export function resetApiBase() {
  apiBase = null;
  resolvingBase = null;
}

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function request(method, path, body, { authed = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authed && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const base = await resolveApiBase();

  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    resetApiBase();
    throw err;
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), {
      status: res.status,
      data,
    });
  }
  return data;
}

export const api = {
  // Auth
  register: (body) => request("POST", "/auth/register", body, { authed: false }),
  login: (body) => request("POST", "/auth/login", body, { authed: false }),
  // The refresh token can arrive as a third-party cookie (dropped cross-site) or
  // as a body token the client persisted; the server accepts either.
  refresh: (refreshToken) =>
    request("POST", "/auth/refresh", refreshToken ? { refreshToken } : undefined, { authed: false }),
  logout: (refreshToken) =>
    request("POST", "/auth/logout", refreshToken ? { refreshToken } : undefined),
  me: () => request("GET", "/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("POST", "/auth/change-password", { currentPassword, newPassword }),
  forgotPassword: (email) => request("POST", "/auth/forgot-password", { email }, { authed: false }),
  resetPassword: (token, password) => request("POST", "/auth/reset-password", { token, password }, { authed: false }),

  // Dashboard
  dashboard: (date) => request("GET", `/dashboard${date ? `?date=${date}` : ""}`),
  rollover: (from, to) => request("POST", "/dashboard/rollover", { from, to }),
  progress: (params) =>
    request("GET", `/progress?${new URLSearchParams(params).toString()}`),

  // Categories
  createCategory: (body) => request("POST", "/categories", body),
  updateCategory: (id, body) => request("PATCH", `/categories/${id}`, body),
  deleteCategory: (id) => request("DELETE", `/categories/${id}`),
  reorderCategories: (categoryIds) => request("POST", "/categories/reorder", { categoryIds }),

  // Actions
  createAction: (catId, body) => request("POST", `/categories/${catId}/actions`, body),
  updateAction: (id, body) => request("PATCH", `/actions/${id}`, body),
  deleteAction: (id) => request("DELETE", `/actions/${id}`),
  reorderActions: (categoryId, actionIds) =>
    request("POST", "/actions/reorder", { categoryId, actionIds }),

  // Results
  createResult: (catId, body) => request("POST", `/categories/${catId}/results`, body),
  updateResult: (id, body) => request("PATCH", `/results/${id}`, body),
  deleteResult: (id) => request("DELETE", `/results/${id}`),
  reorderResults: (categoryId, resultIds) =>
    request("POST", "/results/reorder", { categoryId, resultIds }),

  // Rewards
  createReward: (catId, body) => request("POST", `/categories/${catId}/rewards`, body),
  claimReward: (id) => request("POST", `/rewards/${id}/claim`),
  unclaimReward: (id) => request("POST", `/rewards/${id}/unclaim`),
  deleteReward: (id) => request("DELETE", `/rewards/${id}`),

  // Sync
  sync: (body) => request("POST", "/sync", body),

  // Plan (daily schedule blocks)
  getPlan: () => request("GET", "/plan"),
  savePlan: (body) => request("PUT", "/plan", body),
  createPlanItem: (body) => request("POST", "/plan", body),
  deletePlanItem: (id) => request("DELETE", `/plan/${id}`),

  // Notes (standing list + per-day history)
  getNotes: () => request("GET", "/notes"),
  saveNotes: (body) => request("PUT", "/notes", body),
  createNote: (body) => request("POST", "/notes", body),
  deleteNote: (id) => request("DELETE", `/notes/${id}`),
  clearNotes: () => request("DELETE", "/notes"),

  // Pomodoro
  getPomodoro: () => request("GET", "/pomodoro"),
  savePomodoro: (settings) => request("PUT", "/pomodoro", { settings }),
  resetPomodoro: () => request("DELETE", "/pomodoro"),

  // Month snapshots (server-side, cross-device history)
  snapshots: () => request("GET", "/snapshots"),
  snapshot: (month) => request("GET", `/snapshots/${month}`),
  saveSnapshot: (month, data) => request("PUT", `/snapshots/${month}`, { data }),
};
