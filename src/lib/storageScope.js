// Per-identity storage scoping.
//
// The app is local-first: "accounts" are per-device local profiles (guest vs
// logged-in email). Every portable sub-system (notes checklist, days history,
// pomodoro, plan) keys its localStorage data by the CURRENT identity so two
// accounts on the same device never see each other's data, and guest has its
// own copy.

let currentIdentity = "guest";

// Called by the auth lifecycle whenever the active user changes.
export function setIdentityScope(identity) {
  currentIdentity = identity == null ? "guest" : String(identity);
}

export function getIdentityScope() {
  return currentIdentity;
}

// Scope a storage key: base → "base:identity".
export function scopeKey(base, identity = currentIdentity) {
  return `${base}:${identity}`;
}

// zustand persist adapter that namespaces the persisted blob per identity.
// Reuses the plain localStorage stores but with identity-scoped keys.
export const identityStorage = {
  getItem(name) {
    try {
      return localStorage.getItem(scopeKey(name)) ?? null;
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      localStorage.setItem(scopeKey(name), value);
    } catch {
      /* storage full / unavailable */
    }
  },
  removeItem(name) {
    try {
      localStorage.removeItem(scopeKey(name));
    } catch {
      /* ignore */
    }
  },
};