// Per-identity storage scoping.
//
// The app is local-first: "accounts" are per-device local profiles (guest vs
// logged-in email). Every portable sub-system (notes checklist, days history,
// pomodoro, plan) keys its localStorage data by the CURRENT identity so two
// accounts on the same device never see each other's data, and guest has its
// own copy.

  let currentIdentity = "guest";
  
  // The persist namespace has to be known BEFORE the store rehydrates, because
  // zustand reads the blob synchronously at construction time. Without this
  // marker the app always rehydrated the guest blob, so a server-backed user
  // got whatever the guest slot happened to hold.
  const IDENTITY_KEY = "august-goals-active-identity";
  
  // Called by the auth lifecycle whenever the active user changes. Also
  // persists the choice, so a page reload rehydrates the right namespace.
  export function setIdentityScope(identity) {
    currentIdentity = identity == null ? "guest" : String(identity);
    try {
      localStorage.setItem(IDENTITY_KEY, currentIdentity);
    } catch {
      /* storage unavailable */
    }
  }
  
  // Read the identity saved by the last session, before any store exists.
  export function restoreIdentityScope() {
    try {
      currentIdentity = localStorage.getItem(IDENTITY_KEY) || "guest";
    } catch {
      currentIdentity = "guest";
    }
    return currentIdentity;
  }

export function getIdentityScope() {
  return currentIdentity;
}

  // Scope a storage key: base → "base:identity".
  export function scopeKey(base, identity = currentIdentity) {
    return `${base}:${identity}`;
  }
  
  // One-time migration: the store used to persist a single unscoped blob under
  // GUEST_KEY, so a new account in the same browser inherited the previous
  // account's progressLogs, monthlySnapshots and dailySnapshots. Move whatever
  // sits in the legacy key into the identity it actually belonged to, then
  // leave nothing unscoped behind.
  export function migrateLegacyBlob(legacyKey, fallbackIdentity = "guest") {
    let raw = null;
    try {
      raw = localStorage.getItem(legacyKey);
    } catch {
      return null;
    }
    if (!raw) return null;
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const email = parsed?.state?.user?.email;
    const isGuest = parsed?.state?.isGuest !== false;
    const identity = email && !isGuest ? email : fallbackIdentity;
    const target = scopeKey(legacyKey, identity);
    try {
      // Never clobber a namespace that already holds newer state.
      if (!localStorage.getItem(target)) localStorage.setItem(target, raw);
      localStorage.removeItem(legacyKey);
    } catch {
      /* storage unavailable */
    }
    return identity;
  }

// The refresh token is kept per identity, outside the persisted state blob. The
// server returns it in auth responses because the httpOnly refresh cookie is a
// third-party cookie when the app (GitHub Pages) and API (quick tunnel) are on
// different sites, and browsers drop those.
const REFRESH_TOKEN_KEY = "august-goals-refresh-token";

export function setStoredRefreshToken(token) {
  if (token) identityStorage.setItem(REFRESH_TOKEN_KEY, token);
}
export function getStoredRefreshToken() {
  return identityStorage.getItem(REFRESH_TOKEN_KEY) || null;
}
export function clearStoredRefreshToken() {
  identityStorage.removeItem(REFRESH_TOKEN_KEY);
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