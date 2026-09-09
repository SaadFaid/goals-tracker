import { create } from "zustand";
import { persist } from "zustand/middleware";

const PLAN_KEY = "august-goals-schedule-v1";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `slot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const usePlanStore = create(
  persist(
    (set) => ({
      schedule: [],

      addSlot(slot) {
        const row = {
          id: uid(),
          catId: slot.catId,
          type: slot.type,
          idx: slot.idx,
          label: slot.label,
          catName: slot.catName,
          date: slot.date,
          start: slot.start,
          end: slot.end,
        };
        set((s) => ({ schedule: [...s.schedule, row] }));
        return row;
      },

      removeSlot(id) {
        set((s) => ({ schedule: s.schedule.filter((r) => r.id !== id) }));
      },

      clearDate(date) {
        set((s) => ({ schedule: s.schedule.filter((r) => r.date !== date) }));
      },
    }),
    {
      name: PLAN_KEY,
      partialize: (s) => ({ schedule: s.schedule }),
    }
  )
);