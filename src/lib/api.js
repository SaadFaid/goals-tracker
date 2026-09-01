const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

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

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
  refresh: () => request("POST", "/auth/refresh", undefined, { authed: false }),
  logout: () => request("POST", "/auth/logout"),
  me: () => request("GET", "/auth/me"),
  forgotPassword: (email) => request("POST", "/auth/forgot-password", { email }, { authed: false }),
  resetPassword: (token, password) => request("POST", "/auth/reset-password", { token, password }, { authed: false }),

  // Dashboard
  dashboard: (date) => request("GET", `/dashboard${date ? `?date=${date}` : ""}`),
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

  // Results
  createResult: (catId, body) => request("POST", `/categories/${catId}/results`, body),
  updateResult: (id, body) => request("PATCH", `/results/${id}`, body),
  deleteResult: (id) => request("DELETE", `/results/${id}`),

  // Rewards
  createReward: (catId, body) => request("POST", `/categories/${catId}/rewards`, body),
  claimReward: (id) => request("POST", `/rewards/${id}/claim`),
  deleteReward: (id) => request("DELETE", `/rewards/${id}`),

  // Sync
  sync: (body) => request("POST", "/sync", body),

  // Month snapshots (server-side, cross-device history)
  snapshots: () => request("GET", "/snapshots"),
  snapshot: (month) => request("GET", `/snapshots/${month}`),
  saveSnapshot: (month, data) => request("PUT", `/snapshots/${month}`, { data }),
};
