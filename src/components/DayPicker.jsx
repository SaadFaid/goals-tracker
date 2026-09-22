import { useState } from "react";
import { createPortal } from "react-dom";
import { useGoalsStore } from "../store/useGoalsStore";
import { IconClose } from "./Icons";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const monthDays = (key) => {
  const [y, m] = key.split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
};
const dk = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// A calendar cell: saved days are tappable and show how many daily actions were
// done that day; days without a saved snapshot stay disabled.
function DayCell({ y, m, d, snap, isToday, onPick }) {
  const key = dk(y, m, d);
  const saved = !!snap;
  const done = (snap || []).reduce(
    (n, c) => n + (c.actions || []).filter((a) => a.resetType === "daily" && a.current > 0).length,
    0
  );
  return (
    <button
      type="button"
      disabled={!saved}
      onClick={() => onPick(key)}
      className={`relative aspect-square rounded-lg grid place-items-center text-xs transition-colors ${
        saved
          ? "text-heading hover:bg-accent-muted cursor-pointer"
          : "text-text-tertiary/50 cursor-default"
      } ${isToday ? "ring-1 ring-accent" : ""}`}
      title={saved ? `${MONTHS[m - 1]} ${d} — ${done} done` : `${MONTHS[m - 1]} ${d}`}
    >
      <span>{d}</span>
      {saved && (
        <span
          className="absolute bottom-0.5 w-1 h-1 rounded-full"
          style={{ background: "var(--color-accent)" }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default function DayPicker({ open, onOpenChange }) {
  const now = new Date();
  const [gridYear, setGridYear] = useState(now.getFullYear());
  const [gridMonth, setGridMonth] = useState(now.getMonth());
  const dailySnapshots = useGoalsStore((s) => s.dailySnapshots);
  const switchDay = useGoalsStore((s) => s.switchDay);
  const goLive = useGoalsStore((s) => s.goLive);

  const daysTotal = monthDays(monthKey(gridYear, gridMonth + 1));
  const leadingBlanks = new Date(gridYear, gridMonth, 1).getDay();
  const todayKey = dk(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const pickDay = (dayKey) => {
    switchDay(dayKey);
    onOpenChange?.(false);
  };

  const shiftMonth = (delta) => {
    let m = gridMonth + delta;
    let y = gridYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setGridMonth(m);
    setGridYear(y);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange?.(true)}
        className="nav-btn"
        aria-pressed={!!open}
        title="Past days of your checklist"
        style={{
          border: "1px solid var(--color-border-active)",
          color: "var(--color-text-secondary)",
          background: "linear-gradient(180deg, rgba(229,246,240,0.07), rgba(229,246,240,0.02))",
          boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        Days
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
              <span className="caption text-text-tertiary">Checklist days</span>
              <button type="button" onClick={() => onOpenChange?.(false)} className="text-text-tertiary hover:text-heading" aria-label="Close"><IconClose size={13} /></button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => shiftMonth(-1)} className="stepper-btn" aria-label="Previous month">‹</button>
                <span className="mono text-heading text-sm w-28 text-center">
                  {MONTHS[gridMonth]} {gridYear}
                </span>
                <button type="button" onClick={() => shiftMonth(1)} className="stepper-btn" aria-label="Next month">›</button>
              </span>
              <button
                type="button"
                onClick={() => { setGridMonth(now.getMonth()); setGridYear(now.getFullYear()); goLive(); onOpenChange?.(false); }}
                className="text-[11px] text-accent hover:bg-navy-600 px-2 py-1 rounded-md transition-colors"
              >
                Today
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-center text-[10px] uppercase tracking-wide text-text-tertiary">{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <span key={`b${i}`} aria-hidden="true" />
              ))}
              {Array.from({ length: daysTotal }).map((_, i) => {
                const d = i + 1;
                const key = dk(gridYear, gridMonth + 1, d);
                return (
                  <DayCell
                    key={key}
                    y={gridYear}
                    m={gridMonth + 1}
                    d={d}
                    snap={dailySnapshots[key]}
                    isToday={key === todayKey}
                    onPick={pickDay}
                  />
                );
              })}
            </div>
            <p className="mt-3 pt-2 text-[11px] text-text-tertiary" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: "var(--color-accent)" }} aria-hidden="true" />
              A dot marks a saved day — tap it to open that day's checklist.
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}