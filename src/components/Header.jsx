import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { userData } from "../data/goals";
import { computeOverallPct, statusOf, statusColor } from "../lib/score";
import { useGoalsStore } from "../store/useGoalsStore";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const monthDays = (key) => {
  const [y, m] = key.split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
};
const localKey = () => {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth() + 1);
};

function HistoryRow({ log }) {
  const expected = log.expectedScore ?? Math.round((log.dayOfMonth / userData.totalDays) * 100);
  const status = statusOf(log.qualityScore, expected);
  const col = statusColor(status);
  const label = status === "AHEAD" ? "ahead" : status === "BEHIND" ? "behind" : "on pace";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
      <span className="flex items-center gap-2 text-xs">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] mono"
          style={{ background: "var(--color-navy-600)", color: "var(--color-text-tertiary)" }}>
          {log.dayOfMonth}
        </span>
        <span className="text-muted">Day {log.dayOfMonth}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="mono text-sm font-semibold" style={{ color: col }}>
          {Math.round(log.qualityScore)}%
        </span>
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full" style={{
          color: col,
          background: `${col}22`,
        }}>
          {label}
        </span>
      </span>
    </div>
  );
}

export default function Header({ daysElapsed, categories, logs }) {
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [gridYear, setGridYear] = useState(new Date().getFullYear());
  const selectedMonth = useGoalsStore((s) => s.selectedMonth);
  const viewingHistory = useGoalsStore((s) => s.viewingHistory);
  const monthlySnapshots = useGoalsStore((s) => s.monthlySnapshots);
  const serverSnapshotMonths = useGoalsStore((s) => s.serverSnapshotMonths);
  const switchMonth = useGoalsStore((s) => s.switchMonth);
  const goLive = useGoalsStore((s) => s.goLive);
  const daysElapsedSafe = daysElapsed ?? userData.daysPassed;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Selected month (e.g. "2026-09") drives the whole page.
  const [selYear, selMonthIdx] = (selectedMonth || localKey()).split("-").map(Number);
  const viewed = new Date(selYear, selMonthIdx - 1, 1);
  const viewedMonthName = MONTHS[viewed.getMonth()];
  const viewedYear = viewed.getFullYear();
  const daysTotal = monthDays(selectedMonth);

  const overallPct = categories ? Math.round(computeOverallPct(categories)) : 0;
  const timeProgress = Math.round((daysElapsedSafe / userData.totalDays) * 100);

  // History for the currently-viewed month.
  const viewedLogs = (logs || [])
    .filter((l) => Number(l.year) === viewedYear && Number(l.month) === selMonthIdx)
    .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  const selectMonth = (monthIdx) => {
    switchMonth(monthKey(gridYear, monthIdx + 1));
    setOpen(false);
  };

  return (
    <header className="card card-lift flex flex-col justify-center gap-3 p-6" style={{
      background: "linear-gradient(135deg, var(--color-elevated), var(--color-surface))",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Add a decorative background element */}
      <div className="absolute inset-0" style={{
        pointerEvents: "none",
        background: `linear-gradient(45deg, transparent, var(--color-accent)10, transparent)`,
        transform: "rotate(45deg)",
        width: "200%",
        height: "200%",
        top: "-50%",
        left: "-50%",
        animation: "headerGlow 6s ease-in-out infinite"
      }}></div>
      
      <div className="relative z-10">
        <div>
          <h1 className="display text-heading">
            Tchizu Goal Tracker
          </h1>
          <p className="body text-muted mt-1.5">
            {daysElapsedSafe} of {userData.totalDays} days in. Tap any number on any card to update it — your score recalculates instantly.
          </p>
          
          {/* Show goal progress if categories are provided, otherwise show time progress */}
          {categories && categories.length > 0 ? (
            <>
              <div className="w-full h-2 mb-2 bg-navy-500 rounded overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${overallPct}%` }}></div>
              </div>
              <p className="text-xs text-text-tertiary">
                Goal progress: {overallPct}% 
                {overallPct >= 100 ? 
                  "(Goal achieved! 🎉)" : 
                  overallPct >= 80 ? 
                  "(Almost there! 💪)" : 
                  overallPct >= 50 ? 
                  "(Making progress! 👍)" : 
                  "(Getting started! 🚀)"
                }
              </p>
            </>
          ) : (
            <>
              <div className="w-full h-2 mb-2 bg-navy-500 rounded overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${timeProgress}%` }}></div>
              </div>
              <p className="text-xs text-text-tertiary">
                Time progress: {timeProgress}% ({daysElapsedSafe}/{userData.totalDays} days)
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all btn-lift"
            style={{
              background: "var(--color-accent-muted)",
              border: "1px solid var(--color-border-active)",
            }}
            title="Choose your month"
          >
            <span className="text-sm font-bold text-heading tracking-wide">
              {viewedMonthName} {viewedYear}
            </span>
            <span className="text-[11px] font-semibold text-accent px-2 py-0.5 rounded-full" style={{ background: "rgba(109,245,227,0.12)" }}>
              {daysTotal} days
            </span>
            <span className="text-text-tertiary text-xs" aria-hidden="true">▾</span>
          </button>

          {viewingHistory && (
            <button
              type="button"
              onClick={() => { goLive(); setOpen(false); }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors"
              style={{ background: "rgba(255,161,77,0.15)", color: "#FFA14D" }}
              title="Back to the current month and continue editing"
            >
              ← Back to current month
            </button>
          )}

          <p className="caption" style={{ color: "var(--color-text-tertiary)" }}>
            Expected pace: {Math.round((daysElapsedSafe / userData.totalDays) * 100)}%
          </p>
        </div>
      </div>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(6,14,13,0.7)" }}
            onClick={() => setOpen(false)}
          >
          <div
            className="relative w-full max-w-xs rounded-2xl border border-border-active bg-elevated p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="caption text-text-tertiary">Choose your month</span>
              <button type="button" onClick={() => setOpen(false)} className="text-text-tertiary hover:text-heading text-xs" aria-label="Close">✕</button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1">
                <button type="button" onClick={() => setGridYear((y) => y - 1)} className="stepper-btn" aria-label="Previous year">‹</button>
                <span className="mono text-heading text-sm w-14 text-center">{gridYear}</span>
                <button type="button" onClick={() => setGridYear((y) => y + 1)} className="stepper-btn" aria-label="Next year">›</button>
              </span>
              <button type="button" onClick={() => { setGridYear(now.getFullYear()); goLive(); setOpen(false); }} className="text-[11px] text-accent hover:bg-navy-600 px-2 py-1 rounded-md transition-colors">
                Today
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((m, i) => {
                const key = monthKey(gridYear, i + 1);
                const has = !!monthlySnapshots[key] || serverSnapshotMonths.includes(key);
                const isSel = key === selectedMonth;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectMonth(i)}
                    className={`relative rounded-md px-2 py-1.5 text-xs text-left transition-colors ${isSel ? "bg-accent text-navy-900 font-semibold" : "text-muted hover:bg-navy-600 hover:text-heading"}`}
                  >
                    {m.slice(0, 3)}
                    {has && !isSel && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-success)" }} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-heading">
                  {viewedMonthName} {viewedYear} — History
                </span>
                <span className="text-[11px] text-text-tertiary">
                  {viewedLogs.length} day{viewedLogs.length === 1 ? "" : "s"} logged
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto">
                {viewedLogs.length === 0 ? (
                  <p className="text-sm text-text-tertiary py-3 text-center">Nothing logged this month.</p>
                ) : (
                  viewedLogs.map((log) => <HistoryRow key={log.dayOfMonth} log={log} />)
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
