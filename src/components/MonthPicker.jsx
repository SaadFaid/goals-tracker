import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { userData } from "../data/goals";
import { statusOf, statusColor } from "../lib/score";
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

// A "YYYY-MM-DD" history key rendered as "Mon 21 Sep".
function DayRow({ dayKey, active, onPick, snap }) {
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
      className={`w-full flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-left transition-colors ${active ? "text-accent" : "text-muted hover:text-heading"}`}
    >
      <span className="flex items-center gap-2 text-xs">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] mono"
          style={{ background: "var(--color-navy-600)", color: active ? "var(--color-accent)" : "var(--color-text-tertiary)" }}>
          {d}
        </span>
        <span className="text-xs">{label}</span>
      </span>
      <span className="mono text-xs" style={{ color: active ? "var(--color-accent)" : "var(--color-text-tertiary)" }}>
        {done}/{dailyCount || 0}
      </span>
    </button>
  );
}

export default function MonthPicker({ open, onOpenChange, tab, onTab }) {
  const [now, setNow] = useState(new Date());
  const [gridYear, setGridYear] = useState(new Date().getFullYear());
  const selectedMonth = useGoalsStore((s) => s.selectedMonth);
  const monthlySnapshots = useGoalsStore((s) => s.monthlySnapshots);
  const serverSnapshotMonths = useGoalsStore((s) => s.serverSnapshotMonths);
  const dailySnapshots = useGoalsStore((s) => s.dailySnapshots);
  const viewingHistory = useGoalsStore((s) => s.viewingHistory);
  const logs = useGoalsStore((s) => s.progressLogs);
  const switchMonth = useGoalsStore((s) => s.switchMonth);
  const switchDay = useGoalsStore((s) => s.switchDay);
  const goLive = useGoalsStore((s) => s.goLive);
  const [activeDay, setActiveDay] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const [selYear, selMonthIdx] = (selectedMonth || localKey()).split("-").map(Number);
  const viewed = new Date(selYear, selMonthIdx - 1, 1);
  const viewedMonthName = MONTHS[viewed.getMonth()];
  const viewedYear = viewed.getFullYear();
  const daysTotal = monthDays(selectedMonth);

  const viewedLogs = (logs || [])
    .filter((l) => Number(l.year) === viewedYear && Number(l.month) === selMonthIdx)
    .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  const dayKeys = Object.keys(dailySnapshots || {})
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const selectMonth = (monthIdx) => {
    switchMonth(monthKey(gridYear, monthIdx + 1));
  };

  const pickDay = (dayKey) => {
    setActiveDay(dayKey);
    switchDay(dayKey);
  };

  const goNow = () => {
    setActiveDay(null);
    goLive();
  };

  const isOpen = !!open;
  const usedTab = tab === "days" ? "days" : "month";

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
        title="Choose your month"
      >
        <span className="text-xs font-bold text-heading tracking-wide">
          {viewedMonthName} {viewedYear}
        </span>
        <span className="text-[10px] font-semibold text-accent px-2 py-0.5 rounded-full hidden sm:inline" style={{ background: "rgba(109,245,227,0.12)" }}>
          {daysTotal} days
        </span>
        <span className="text-text-tertiary text-xs" aria-hidden="true">▾</span>
      </button>

      {isOpen &&
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
              <span className="caption text-text-tertiary">History</span>
              <button type="button" onClick={() => onOpenChange?.(false)} className="text-text-tertiary hover:text-heading" aria-label="Close"><IconClose size={13} /></button>
            </div>

            <div className="flex items-center gap-1 mb-2 rounded-lg p-0.5" style={{ background: "var(--color-navy-700)" }}>
              <button
                type="button"
                onClick={() => onTab?.("month")}
                className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${usedTab === "month" ? "bg-accent text-navy-900 font-semibold" : "text-muted hover:text-heading"}`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => onTab?.("days")}
                className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${usedTab === "days" ? "bg-accent text-navy-900 font-semibold" : "text-muted hover:text-heading"}`}
              >
                Days
              </button>
            </div>

            {usedTab === "days" ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-heading">Checklist history</span>
                  <button type="button" onClick={goNow} className="text-[11px] text-accent hover:bg-navy-600 px-2 py-1 rounded-md transition-colors">
                    {viewingHistory ? "Today" : "Live"}
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {dayKeys.length === 0 ? (
                    <p className="text-sm text-text-tertiary py-3 text-center">No saved days yet.</p>
                  ) : (
                    dayKeys.map((key) => (
                      <DayRow key={key} dayKey={key} snap={dailySnapshots[key]} active={key === activeDay} onPick={pickDay} />
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => setGridYear((y) => y - 1)} className="stepper-btn" aria-label="Previous year">‹</button>
                    <span className="mono text-heading text-sm w-14 text-center">{gridYear}</span>
                    <button type="button" onClick={() => setGridYear((y) => y + 1)} className="stepper-btn" aria-label="Next year">›</button>
                  </span>
                  <button type="button" onClick={() => { setGridYear(now.getFullYear()); goNow(); }} className="text-[11px] text-accent hover:bg-navy-600 px-2 py-1 rounded-md transition-colors">
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
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}