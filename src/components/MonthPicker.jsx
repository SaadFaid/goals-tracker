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
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const monthDays = (key) => {
  const [y, m] = key.split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
};
const localKey = () => {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth() + 1);
};
const dk = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function dayLabel(dayKey) {
  const [y, m, d] = (dayKey || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

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

// One line of what was typed/checked on a saved day: filled dot for done
// (current>0), open dot for not done.
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

export default function MonthPicker() {
  const now = new Date();
  const [nowTick, setNowTick] = useState(now);
  const [open, setOpen] = useState(false);
  const [gridYear, setGridYear] = useState(now.getFullYear());
  // Which section of the popup is showing: the month grid/history, or the
  // day calendar + a selected day's checklist.
  const [view, setView] = useState("month");
  const [dayGridYear, setDayGridYear] = useState(now.getFullYear());
  const [dayGridMonth, setDayGridMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const selectedMonth = useGoalsStore((s) => s.selectedMonth);
  const monthlySnapshots = useGoalsStore((s) => s.monthlySnapshots);
  const serverSnapshotMonths = useGoalsStore((s) => s.serverSnapshotMonths);
  const dailySnapshots = useGoalsStore((s) => s.dailySnapshots);
  const logs = useGoalsStore((s) => s.progressLogs);
  const switchMonth = useGoalsStore((s) => s.switchMonth);
  const goLive = useGoalsStore((s) => s.goLive);

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 30000);
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

  const selectMonth = (monthIdx) => {
    switchMonth(monthKey(gridYear, monthIdx + 1));
    setOpen(false);
  };

  // ── Days view helpers ──────────────────────────────
  const dayKeys = Object.keys(dailySnapshots || {})
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const activeDay = selectedDay || dayKeys[0] || null;
  const dayTotal = monthDays(monthKey(dayGridYear, dayGridMonth + 1));
  const dayLeading = new Date(dayGridYear, dayGridMonth, 1).getDay();
  const todayKey = dk(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const openDays = () => {
    setDayGridMonth(now.getMonth());
    setDayGridYear(now.getFullYear());
    setSelectedDay(dayKeys[0] || null);
    setView("days");
  };

  const shiftDayMonth = (delta) => {
    let m = dayGridMonth + delta;
    let y = dayGridYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setDayGridMonth(m);
    setDayGridYear(y);
  };

  const scrollDay = (dir) => {
    if (dayKeys.length === 0) return;
    const idx = dayKeys.indexOf(activeDay);
    const nxt = Math.max(0, Math.min(dayKeys.length - 1, idx + dir));
    if (dayKeys[nxt]) setSelectedDay(dayKeys[nxt]);
  };

  const goToday = () => {
    setGridYear(nowTick.getFullYear());
    setDayGridMonth(nowTick.getMonth());
    setDayGridYear(nowTick.getFullYear());
    setSelectedDay(null);
    goLive();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setView("month"); setOpen(true); }}
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
              <span className="caption text-text-tertiary">Checklist history</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "var(--color-navy-700)" }}>
                  <button
                    type="button"
                    onClick={() => setView("month")}
                    className={`rounded-md px-2 py-1 text-[11px] transition-colors ${view === "month" ? "bg-accent text-navy-900 font-semibold" : "text-muted hover:text-heading"}`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={openDays}
                    className={`rounded-md px-2 py-1 text-[11px] transition-colors ${view === "days" ? "bg-accent text-navy-900 font-semibold" : "text-muted hover:text-heading"}`}
                    title="Your checklist history, day by day"
                  >
                    Days
                  </button>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="text-text-tertiary hover:text-heading" aria-label="Close"><IconClose size={13} /></button>
              </div>
            </div>

            {view === "days" ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => shiftDayMonth(-1)} className="stepper-btn" aria-label="Previous month">‹</button>
                    <span className="mono text-heading text-sm w-28 text-center">
                      {MONTHS[dayGridMonth]} {dayGridYear}
                    </span>
                    <button type="button" onClick={() => shiftDayMonth(1)} className="stepper-btn" aria-label="Next month">›</button>
                  </span>
                  <button type="button" onClick={goToday} className="text-[11px] text-accent hover:bg-navy-600 px-2 py-1 rounded-md transition-colors">
                    Today
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="text-center text-[10px] uppercase tracking-wide text-text-tertiary">{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: dayLeading }).map((_, i) => (
                    <span key={`b${i}`} aria-hidden="true" />
                  ))}
                  {Array.from({ length: dayTotal }).map((_, i) => {
                    const d = i + 1;
                    const key = dk(dayGridYear, dayGridMonth + 1, d);
                    const saved = !!dailySnapshots[key];
                    const isSel = key === activeDay;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!saved}
                        onClick={() => setSelectedDay(key)}
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
                    <button type="button" onClick={() => scrollDay(-1)} disabled={!activeDay} className="stepper-btn" aria-label="Previous day">‹</button>
                    <span className="text-xs font-semibold text-heading">
                      {activeDay ? dayLabel(activeDay) : "No saved days"}
                    </span>
                    <button type="button" onClick={() => scrollDay(1)} disabled={!activeDay} className="stepper-btn" aria-label="Next day">›</button>
                  </div>
                  {dayKeys.length === 0 ? (
                    <p className="text-sm text-text-tertiary py-3 text-center">No saved days yet.</p>
                  ) : (
                    <>
                      <DayContent snap={dailySnapshots[activeDay]} />
                      <p className="mt-1 text-[11px] text-text-tertiary">
                        {activeDay} <span className="text-text-tertiary/70">· ● done ○ not done · starts saving from today</span>
                      </p>
                    </>
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
                  <button type="button" onClick={goToday} className="text-[11px] text-accent hover:bg-navy-600 px-2 py-1 rounded-md transition-colors">
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