import { createPortal } from "react-dom";
import { useGoalsStore } from "../store/useGoalsStore";
import { IconClose } from "./Icons";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const monthDays = (key) => {
  const [y, m] = key.split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
};
const localKey = () => {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth() + 1);
};

// A "YYYY-MM-DD" history key rendered as "Mon 21 Sep".
function DayRow({ dayKey, snap, onPick }) {
  const [y, m, d] = (dayKey || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  const label = `${WEEKDAYS[date.getDay()]} ${d} ${MONTHS[date.getMonth()].slice(0, 3)}`;
  const done = (snap || []).reduce(
    (n, c) => n + (c.actions || []).filter((a) => a.resetType === "daily" && a.current > 0).length,
    0
  );
  const dailyCount = (snap || []).reduce(
    (n, c) => n + (c.actions || []).filter((a) => a.resetType === "daily").length,
    0
  );
  return (
    <button
      type="button"
      onClick={() => onPick(dayKey)}
      className="w-full flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-left transition-colors text-muted hover:text-heading"
    >
      <span className="flex items-center gap-2 text-xs">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] mono"
          style={{ background: "var(--color-navy-600)", color: "var(--color-text-tertiary)" }}>
          {d}
        </span>
        <span className="text-xs">{label}</span>
      </span>
      <span className="mono text-xs" style={{ color: "var(--color-text-tertiary)" }}>
        {done}/{dailyCount || 0}
      </span>
    </button>
  );
}

export default function MonthPicker({ open, onOpenChange }) {
  const selectedMonth = useGoalsStore((s) => s.selectedMonth);
  const dailySnapshots = useGoalsStore((s) => s.dailySnapshots);
  const switchDay = useGoalsStore((s) => s.switchDay);
  const goLive = useGoalsStore((s) => s.goLive);

  const [selYear, selMonthIdx] = (selectedMonth || localKey()).split("-").map(Number);
  const viewed = new Date(selYear, selMonthIdx - 1, 1);
  const viewedMonthName = MONTHS[viewed.getMonth()];
  const viewedYear = viewed.getFullYear();
  const daysTotal = monthDays(selectedMonth);

  const dayKeys = Object.keys(dailySnapshots || {})
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const pickDay = (dayKey) => {
    switchDay(dayKey);
    onOpenChange?.(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange?.(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all btn-lift"
        style={{
          background: "var(--color-accent-muted)",
          border: "1px solid var(--color-border-active)",
        }}
        title="Saved days of your checklist"
      >
        <span className="text-xs font-bold text-heading tracking-wide">
          {viewedMonthName} {viewedYear}
        </span>
        <span className="text-[10px] font-semibold text-accent px-2 py-0.5 rounded-full hidden sm:inline" style={{ background: "rgba(109,245,227,0.12)" }}>
          {daysTotal} days
        </span>
        <span className="text-text-tertiary text-xs" aria-hidden="true">▾</span>
      </button>

      {!!open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(6,14,13,0.7)" }}
            onClick={() => onOpenChange?.(false)}
          >
          <div
            className="relative w-full max-w-xs rounded-2xl border border-border-active bg-elevated p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="caption text-text-tertiary">Checklist history</span>
              <button type="button" onClick={() => onOpenChange?.(false)} className="text-text-tertiary hover:text-heading" aria-label="Close"><IconClose size={13} /></button>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-heading">Saved days</span>
              <button type="button" onClick={() => { goLive(); onOpenChange?.(false); }} className="text-[11px] text-accent hover:bg-navy-600 px-2 py-1 rounded-md transition-colors">
                Today
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {dayKeys.length === 0 ? (
                <p className="text-sm text-text-tertiary py-3 text-center">No saved days yet.</p>
              ) : (
                dayKeys.map((key) => (
                  <DayRow key={key} dayKey={key} snap={dailySnapshots[key]} onPick={pickDay} />
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}