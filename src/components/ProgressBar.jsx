import { useMemo } from "react";
import { useGoalsStore } from "../store/useGoalsStore";

const EXEC_PINK = "#DB6088";
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const monthDays = (key) => {
  const [y, m] = key.split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
};

export default function ProgressBar() {
  const progressLogs = useGoalsStore((s) => s.progressLogs);
  const dashboard = useGoalsStore((s) => s.dashboard);
  const selectedMonth = useGoalsStore((s) => s.selectedMonth);

  const now = new Date();
  const liveKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isLive = selectedMonth === liveKey;

  const [selYear, selMonthIdx] = (selectedMonth || "").split("-").map(Number);
  const title = selYear ? `${MONTHS[selMonthIdx - 1]} ${selYear}` : "";
  const daysTotal = monthDays(selectedMonth);

  // Live month → live dashboard stats (updates on every check). History month → last saved log.
  const monthStats = useMemo(() => {
    if (isLive) {
      const quality = dashboard?.stats?.qualityPercent ?? 0;
      const expected = dashboard?.stats?.expectedPercent ?? 0;
      const daysDone = dashboard?.meta?.dayOfMonth ?? 0;
      const daysInMonth = dashboard?.meta?.daysInMonth ?? daysTotal;
      return {
        actual: quality,
        expected,
        daysCompleted: daysDone,
        daysTotal: daysInMonth,
        daysInMonth,
      };
    }
    const logs = (progressLogs || []).filter(
      (l) => Number(l.year) === selYear && Number(l.month) === selMonthIdx
    );
    if (logs.length === 0) return null;
    const last = logs[logs.length - 1];
    return {
      actual: last.qualityScore,
      expected: last.expectedScore,
      daysCompleted: last.dayOfMonth,
      daysTotal,
      daysInMonth: daysTotal,
    };
  }, [isLive, dashboard, progressLogs, selYear, selMonthIdx, daysTotal]);

  const hasData = !!monthStats;
  const diff = hasData ? Math.round(monthStats.actual) - Math.round(monthStats.expected) : null;
  const status = !hasData ? "empty" : diff >= 1 ? "AHEAD" : diff <= -1 ? "BEHIND" : "ON TRACK";
  const STATUS_WORDS = { AHEAD: "Ahead", "ON TRACK": "On Track", BEHIND: "Behind", empty: "No data" };
  const STATUS_COLORS = {
    AHEAD: "#6DF5E3",
    "ON TRACK": "#87FF5F",
    BEHIND: "#DB6088",
    empty: "var(--color-text-tertiary)",
  };
  const statusWord = STATUS_WORDS[status];
  const statusFill = STATUS_COLORS[status];

  const delta = diff;
  const deltaColor = !hasData ? "var(--color-text-tertiary)"
    : delta >= 1 ? "#6DF5E3"
    : delta <= -1 ? "#DB6088"
    : "var(--color-text-tertiary)";

  return (
    <section
      className="card card-lift p-6"
      aria-label="Execution score"
      style={{
        background: "linear-gradient(135deg, var(--color-elevated), var(--color-surface))",
        border: "1px solid var(--color-border-active)",
        position: "relative",
        overflow: "hidden",
        opacity: hasData ? 1 : 0.55,
        transition: "opacity 0.2s",
      }}
    >
      <div className="absolute inset-0" style={{
        pointerEvents: "none",
        background: `linear-gradient(45deg, transparent, ${EXEC_PINK}20, transparent)`,
        transform: "rotate(45deg)",
        width: "200%",
        height: "200%",
        top: "-50%",
        left: "-50%",
        animation: "glowMove 4s ease-in-out infinite",
      }}></div>

      <div className="relative z-10 flex items-center justify-between mb-4">
        <span className="caption" style={{ color: "var(--color-text-tertiary)" }}>
          Execution score
        </span>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{
          background: !isLive ? "rgba(255,161,77,0.15)" : "var(--color-accent-muted)",
          color: !isLive ? "#FFA14D" : "var(--color-accent)",
          letterSpacing: "0.04em",
        }} title="Month shown below is set from the header">
          {title}{hasData ? ` · Day ${monthStats.daysCompleted}/${daysTotal}` : ` · Day 0/${daysTotal}`}
        </span>
      </div>

      {hasData ? (
        <>
          <div className="relative z-10 flex items-end gap-6 flex-wrap">
            <span className="score-readout">
              <span className="score-val" style={{
                color: deltaColor,
                fontSize: "64px",
                letterSpacing: "-0.03em",
                textShadow: `0 0 16px ${deltaColor}40`,
                filter: `drop-shadow(0 0 8px ${deltaColor}30)`,
              }}>
                {delta === 0 ? "±0" : delta > 0 ? `+${delta}` : delta}
                <span style={{ fontSize: 28, color: deltaColor, fontWeight: 500, marginLeft: 4 }}>%</span>
              </span>
            </span>
            <div className="pb-1">
              <div className="text-sm" style={{ color: statusFill, fontWeight: 600, letterSpacing: "0.02em" }}>
                {statusWord}
              </div>
            </div>
          </div>

          <div className="relative z-10 score-rail mt-6">
            <div
              className="score-rail-fill"
              style={{
                width: `${Math.min(monthStats.actual, 100)}%`,
                background: EXEC_PINK,
                boxShadow: `0 0 8px ${EXEC_PINK}40`,
              }}
            />
            <span
              aria-hidden="true"
              title={`Expected pace ${Math.round(monthStats.expected)}%`}
              style={{
                position: "absolute",
                top: -6,
                left: `calc(${Math.min(Math.max(monthStats.expected, 0), 100)}% - 5px)`,
                width: 10,
                height: 10,
                background: "var(--color-accent-2)",
                borderRadius: "2px",
                transform: "rotate(45deg)",
                boxShadow: "0 0 5px var(--color-accent-2), 0 0 12px var(--color-accent-2-muted)",
                zIndex: 2,
              }}
            />
          </div>

          <div className="relative z-10 flex items-center justify-between mt-4 text-xs">
            <span className="text-muted">Actual <strong className="mono text-heading">{Math.round(monthStats.actual)}%</strong></span>
            <span className="text-muted">Expected <strong className="mono" style={{ color: "var(--color-accent-2)" }}>{Math.round(monthStats.expected)}%</strong></span>
            <span className="text-muted">Days <strong className="mono text-heading">{monthStats.daysCompleted}/{monthStats.daysTotal}</strong></span>
          </div>
        </>
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center text-center py-8">
          <div className="text-3xl mb-2">📭</div>
          <div className="text-sm font-semibold text-heading">No data yet for {title}</div>
          <div className="text-xs text-text-tertiary mt-1">
            Actual –% · Expected –% · Days 0/{daysTotal}
          </div>
        </div>
      )}
    </section>
  );
}
