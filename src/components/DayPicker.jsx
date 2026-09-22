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

function dayLabel(dayKey) {
  const [y, m, d] = (dayKey || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// One line of what was typed/checked on a saved day: check for done (current>0),
// open circle for not-done. Daily actions drive the check state.
function DayContent({ snap }) {
  const cats = (snap || []).filter((c) => !c.isRewards);
  if (cats.length === 0) {
    return <p className="text-sm text-text-tertiary py-3 text-center">Nothing saved for this day.</p>;
  }
  return (
    <div className="max-h-56 overflow-y-auto">
      {cats.map((cat) => {
        const actions = cat.actions || [];
        const results = cat.results || [];
        if (actions.length === 0 && results.length === 0) return null;
        return (
          <div key={cat.id} className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `var(--color-${cat.dotColor || "turquoise"})` }} aria-hidden="true" />
              <span className="text-xs font-semibold text-heading">{cat.name}</span>
            </div>
            <div className="pl-4 space-y-0.5">
              {actions.map((a) => {
                const done = a.current > 0;
                return (
                  <div key={a.id} className="flex items-center gap-2 text-xs">
                    <span style={{ color: "var(--color-text-tertiary)" }} aria-hidden="true">{done ? "●" : "○"}</span>
                    <span className={done ? "text-muted" : "text-text-tertiary line-through decoration-text-tertiary/40"}>{a.label}</span>
                    <span className="mono ml-auto text-[10px] text-text-tertiary">{a.current}/{a.target}</span>
                  </div>
                );
              })}
              {results.map((r) => {
                const done = r.current > 0;
                return (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span style={{ color: "var(--color-text-tertiary)" }} aria-hidden="true">{done ? "●" : "○"}</span>
                    <span className={done ? "text-muted" : "text-text-tertiary line-through decoration-text-tertiary/40"}>{r.label}</span>
                    <span className="mono ml-auto text-[10px] text-text-tertiary">{r.current}/{r.target}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DayPicker({ open, onOpenChange }) {
  const now = new Date();
  const [gridYear, setGridYear] = useState(now.getFullYear());
  const [gridMonth, setGridMonth] = useState(now.getMonth());
  const dailySnapshots = useGoalsStore((s) => s.dailySnapshots);
  const goLive = useGoalsStore((s) => s.goLive);

  const daysTotal = monthDays(monthKey(gridYear, gridMonth + 1));
  const leadingBlanks = new Date(gridYear, gridMonth, 1).getDay();
  const todayKey = dk(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const dayKeys = Object.keys(dailySnapshots || {})
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  // The day currently shown in the detail pane. Defaults to the most recent
  // saved day; the ‹ › arrows scroll through the full saved history.
  const [selected, setSelected] = useState(null);

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

  const scroll = (dir) => {
    if (dayKeys.length === 0) return;
    const cur = selected || dayKeys[0];
    const idx = dayKeys.indexOf(cur);
    const nxt = Math.max(0, Math.min(dayKeys.length - 1, idx + dir));
    if (dayKeys[nxt]) setSelected(dayKeys[nxt]);
  };

  const openModal = () => {
    setGridMonth(now.getMonth());
    setGridYear(now.getFullYear());
    setSelected(dayKeys[0] || null);
    onOpenChange?.(true);
  };

  const active = selected || dayKeys[0] || null;
  const shownSnap = active ? dailySnapshots[active] : null;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
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
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => shiftMonth(-1)} className="stepper-btn" aria-label="Previous month">‹</button>
                <span className="mono text-heading text-sm w-28 text-center">
                  {MONTHS[gridMonth]} {gridYear}
                </span>
                <button type="button" onClick={() => shiftMonth(1)} className="stepper-btn" aria-label="Next month">›</button>
              </span>
              <button
                type="button"
                onClick={() => { setGridMonth(now.getMonth()); setGridYear(now.getFullYear()); setSelected(null); goLive(); onOpenChange?.(false); }}
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
                const saved = !!dailySnapshots[key];
                const isSel = key === active;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!saved}
                    onClick={() => setSelected(key)}
                    className={`relative aspect-square rounded-lg grid place-items-center text-xs transition-colors ${
                      saved
                        ? "text-heading hover:bg-accent-muted cursor-pointer"
                        : "text-text-tertiary/50 cursor-default"
                    } ${isSel ? "bg-accent text-navy-900 font-semibold" : key === todayKey ? "ring-1 ring-accent" : ""}`}
                    title={saved ? `Open ${dayLabel(key)}` : dayLabel(key)}
                  >
                    <span>{d}</span>
                    {saved && !isSel && (
                      <span
                        className="absolute bottom-0.5 w-1 h-1 rounded-full"
                        style={{ background: "var(--color-accent)" }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
              <div className="flex items-center justify-between mb-1">
                <button type="button" onClick={() => scroll(-1)} disabled={!active} className="stepper-btn" aria-label="Previous day">‹</button>
                <span className="text-xs font-semibold text-heading">
                  {active ? dayLabel(active) : "No saved days"}
                </span>
                <button type="button" onClick={() => scroll(1)} disabled={!active} className="stepper-btn" aria-label="Next day">›</button>
              </div>
              {dayKeys.length === 0 ? (
                <p className="text-sm text-text-tertiary py-3 text-center">No saved days yet.</p>
              ) : (
                <>
                  <DayContent snap={shownSnap} />
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    {selected || dayKeys[0]} <span className="text-text-tertiary/70">· ● done · ○ not done</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}