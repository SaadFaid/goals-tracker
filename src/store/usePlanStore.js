import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getIdentityScope, identityStorage } from "../lib/storageScope";
import { useGoalsStore } from "./useGoalsStore";
import { makeExamplePlanRows } from "../lib/seedExamples";

const PLAN_KEY = "august-goals-schedule-v1";
const MAX_HISTORY = 30;

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Read the persisted plan for the CURRENT identity (used when identity change
// or first boot needs a fresh load, bypassing the module-level persist buffer).
function readIdentityPlan() {
  let raw = null;
  try {
    raw = identityStorage.getItem(PLAN_KEY);
  } catch {
    /* ignore */
  }
  const out = { schedule: [], past: [] };
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const state = parsed?.state && typeof parsed.state === "object" ? parsed.state : parsed;
      if (Array.isArray(state?.schedule)) out.schedule = state.schedule;
      if (Array.isArray(state?.past)) out.past = state.past.slice(-MAX_HISTORY);
    } catch {
      /* fall back to seed */
    }
  }
  if (out.schedule.length === 0) {
    // First use for this identity: seed example schedule rows so the Plan view
    // has something across the last months. Real additions take over.
    out.schedule = makeExamplePlanRows();
  }
  return out;
}

export const usePlanStore = create(
  persist(
    (set, get) => ({
      schedule: [],
      past: [],

      // (Re)load the schedule for the currently active identity, seeding
      // examples on first use. Called on boot and on account switch.
      reloadForIdentity() {
        set(readIdentityPlan());
      },

      remember() {
        const s = get();
        set({ past: [...s.past.slice(-(MAX_HISTORY - 1)), s.schedule] });
      },

      canUndo() {
        return get().past.length > 0;
      },

      undo() {
        const s = get();
        if (s.past.length === 0) return false;
        const last = s.past[s.past.length - 1];
        set({ schedule: last, past: s.past.slice(0, -1) });
        return true;
      },

      addSlot(slot) {
        get().remember();
        const row = {
          id: uid(),
          catId: slot.catId,
          type: slot.type,
          idx: slot.idx,
          label: slot.label,
          catName: slot.catName,
          color: slot.color,
          note: slot.note,
          date: slot.date,
          start: slot.start,
          end: slot.end,
          repeat: slot.repeat || "today",
          repeatDay: slot.repeatDay,
        };
        set((s) => ({ schedule: [...s.schedule, row] }));
        return row;
      },

      updateSlot(id, patch) {
        get().remember();
        set((s) => ({
          schedule: s.schedule.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)),
        }));
      },

      removeSlot(id) {
        get().remember();
        set((s) => ({ schedule: s.schedule.filter((r) => r.id !== id) }));
      },

      clearDate(date) {
        get().remember();
        set((s) => ({ schedule: s.schedule.filter((r) => r.date !== date) }));
      },
    }),
    {
      name: PLAN_KEY,
      storage: identityStorage,
      partialize: (s) => ({ schedule: s.schedule, past: s.past.slice(-MAX_HISTORY) }),
    }
  )
);

// Reload the plan whenever the active identity changes (login/logout/guest).
let lastPlanIdentity = getIdentityScope();
useGoalsStore.subscribe(() => {
  const id = getIdentityScope();
  if (id !== lastPlanIdentity) {
    lastPlanIdentity = id;
    usePlanStore.getState().reloadForIdentity();
  }
});

// Ensure the first active identity is loaded even if nothing rehydrated (fresh
// module boot) — consume whatever persist already seeded.
queueMicrotask(() => {
  usePlanStore.setState(readIdentityPlan());
});