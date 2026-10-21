// One-time migration from the pre-rebrand storage keys to the Paceline ones.
//
// The product was renamed, but the data already on people's devices is theirs:
// renaming a localStorage key without moving its contents silently wipes it.
// So the old keys are read once, copied to the new ones and removed. After the
// first run there is nothing left to move, and the old names are gone from the
// rest of the app.

const KEY_RENAMES = [
  ["august-goals-guest-v2", "paceline-guest-v2"],
  ["august-goals-active-identity", "paceline-active-identity"],
  ["august-goals-refresh-token", "paceline-refresh-token"],
  ["august-goals-profiles", "paceline-profiles"],
  ["august-goals-notes", "paceline-notes"],
  ["august-goals-notes-days", "paceline-notes-days"],
  ["august-goals-pomodoro", "paceline-pomodoro"],
  ["august-goals-alerts", "paceline-alerts"],
  ["august-goals-schedule-v1", "paceline-schedule-v1"],
];

const DONE_FLAG = "paceline-brand-migrated";

export function migrateBrandKeys() {
  let store = null;
  try {
    store = window.localStorage;
  } catch {
    return;
  }
  if (!store) return;
  try {
    if (store.getItem(DONE_FLAG)) return;
  } catch {
    return;
  }

  try {
    const keys = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k) keys.push(k);
    }
    for (const key of keys) {
      for (const [from, to] of KEY_RENAMES) {
        if (key !== from && !key.startsWith(`${from}:`)) continue;
        const next = key === from ? to : `${to}${key.slice(from.length)}`;
        if (store.getItem(next) == null) {
          store.setItem(next, store.getItem(key));
        }
        store.removeItem(key);
      }
    }
    store.setItem(DONE_FLAG, "1");
  } catch {
    /* storage unavailable — the app still works, it just starts fresh */
  }
}

// The salt used by the offline-only local profiles before the rename. It is
// only needed to check a password that was hashed under the old scheme; the
// profile is re-hashed with the current salt the moment it verifies.
export const LEGACY_LOCAL_SALT = "august-goals::";
export const LOCAL_SALT = "paceline::";
