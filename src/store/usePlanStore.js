import { create } from "zustand";
import { persist } from "zustand/middleware";

const PLAN_KEY = "august-goals-schedule-v1";
const MAX_HISTORY = 30;

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const usePlanStore = create(
  persist(
    (set, get) => ({
      schedule: [],
      past: [],

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
      partialize: (s) => ({ schedule: s.schedule, past: s.past.slice(-MAX_HISTORY) }),
    }
  )
);