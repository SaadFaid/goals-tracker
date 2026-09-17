import { useRef, useState } from "react";
import { userData } from "../data/goals";
import { useGoalsStore } from "../store/useGoalsStore";
import { aggregateResultsPct } from "../lib/score";
import { IconBolt, IconFire, IconCheckCircle } from "./Icons";

const ACCENT = "#6DF5E3"; // mint — today marker
const EXPECTED = "#9CA3AF"; // grey — should-be pace line
const RESULT = "#FFA14D"; // orange — results progress (consistent across dashboard)
const PINK = "#DB6088"; // pink — actual/executed progress
const STATUS_COLORS = {
  AHEAD: "#6DF5E3",
  BEHIND: "#DB6088",
  "ON TRACK": "#87FF5F",
};

// upward progress chart (0 → 100%):
//  - Execution: daily quality score, drawn only on days progress was made (ascending), live today point.
//  - Should be: straight dashed pace line, 0% on day 1 → 100% on the last day.
//  - Results: aggregate result completion line, drawn only on real results days.
export default function ProgressChart({ logs, dashboard }) {
  const selectedMonth = useGoalsStore((s) => s.selectedMonth);
  const w = 480;
  const hMobile = 180;
  const hDesktop = 220;
  const pad = { top: 14, right: 14, bottom: 26, left: 34 };
  const cw = w - pad.left - pad.right;
  const ch = hDesktop - pad.top - pad.bottom;

  const [hoverDay, setHoverDay] = useState(null);
  const svgRef = useRef(null);

  const totalDays = (() => {
    const [y, m] = (selectedMonth || "").split("-").map(Number);
    return y && m ? new Date(y, m, 0).getDate() : userData.totalDays;
  })();
  const metaDate = dashboard?.meta?.currentDate ? new Date(dashboard.meta.currentDate) : new Date();
  const viewYear = Number((selectedMonth || "").split("-")[0]) || metaDate.getFullYear();
  const viewMonth = Number((selectedMonth || "").split("-")[1]) || (metaDate.getMonth() + 1);
  const resultsPct = Math.round(aggregateResultsPct(dashboard?.categories));

  const points = (logs || [])
    .map((l) => ({
      day: l.dayOfMonth,
      value: l.qualityScore,
      results: l.resultsScore,
      dateKey: `${l.year}-${l.month}-${l.dayOfMonth}`,
    }))
    .filter((p) => (Number(p.dateKey.split("-")[0]) === viewYear && Number(p.dateKey.split("-")[1]) === viewMonth))
    .filter((p) => p.day >= 1 && p.day <= totalDays)
    .sort((a, b) => a.day - b.day);

  // Live "today" point: use the real quality score from dashboard, not synthetic logs.
  // At 00:00 the new day has no progress yet, so the live point is hidden.
  const now = new Date();
  const isLiveMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;
  const atMidnight = now.getHours() === 0 && now.getMinutes() === 0;
  const showLiveToday = isLiveMonth && !atMidnight;
  // The chart runs to the last day progress was actually made; a live point
  // extends it to today only while the current day is still in progress.
  const lastLoggedDay = points.length ? points[points.length - 1].day : null;
  const today = showLiveToday ? now.getDate() : lastLoggedDay ?? 1;
  const liveScore = dashboard?.stats?.qualityPercent ?? (points.length ? points[points.length - 1].value : 0);

  const x = (day) => pad.left + ((day - 1) / (totalDays - 1)) * cw;
  const y = (pct) => pad.top + ch - (Math.max(0, Math.min(pct, 100)) / 100) * ch;

  // Should be: straight pace line from 0% on day 1 to 100% on the last day.
  const expectedAt = (d) => (totalDays > 1 ? ((d - 1) / (totalDays - 1)) * 100 : 0);
  const expectedPath = `M ${x(1)} ${y(0)} L ${x(totalDays)} ${y(100)}`;

  // Execution line: drawn only on days progress was actually made (plus the live
  // today point while the day is in progress) — no carry-forward across gaps, so
  // the line ends at the last progress day, never dragging forward into empty days.
  const execByDay = new Map();
  for (const p of points) execByDay.set(p.day, p.value);
  if (showLiveToday) execByDay.set(today, liveScore);
  const execSteps = [...execByDay]
    .sort((a, b) => a[0] - b[0])
    .map(([day, value]) => ({ day, value }));
  const actualPath = execSteps.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.day)} ${y(p.value)}`).join(" ");
  const areaPath = execSteps.length
    ? `${actualPath} L ${x(execSteps[execSteps.length - 1].day)} ${y(0)} Z`
    : "";

  // Results line: same rule — real results days only, ends at the last one.
  const resByDay = new Map();
  for (const p of points) {
    if (typeof p.results === "number") resByDay.set(p.day, p.results);
  }
  if (showLiveToday) resByDay.set(today, resultsPct);
  const resSteps = [...resByDay]
    .sort((a, b) => a[0] - b[0])
    .map(([day, value]) => ({ day, value }));
  const resultsPath = resSteps.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.day)} ${y(p.value)}`).join(" ");

  const ticks = [5, 10, 15, 20, 25, 30];
  const gridLines = [25, 50, 75, 100];

  const expectedToday = expectedAt(today);
  const lastStatus =
    liveScore >= expectedToday + 3
      ? "AHEAD"
      : liveScore <= expectedToday - 3
      ? "BEHIND"
      : "ON TRACK";

  const handleMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const dayFrac = ((px - pad.left) / cw) * (totalDays - 1) + 1;
    const nearest = Math.max(1, Math.min(today, Math.round(dayFrac)));
    setHoverDay(nearest);
  };

  const logForDay = (d) => points.find((p) => p.day === d);
  const tooltip = hoverDay != null
    ? (() => {
        const actual = hoverDay === today ? liveScore : logForDay(hoverDay)?.value ?? null;
        const expected = Math.round(expectedAt(hoverDay));
        return {
          expected,
          actual,
          hasLog: hoverDay === today || !!logForDay(hoverDay),
          results: hoverDay >= today ? resultsPct : 0,
        };
      })()
    : null;

  return (
    <section className="card p-4" aria-label="Progress to goal" style={{
      background: "linear-gradient(135deg, var(--color-elevated), var(--color-surface))",
      border: "1px solid var(--color-border-active)",
      position: "relative",
      overflow: "hidden"
    }}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-xs font-bold text-heading tracking-wide leading-tight">
            Progress
          </h2>
          <p className="text-[10px] text-text-tertiary mt-0.5">Daily execution vs pace</p>
        </div>
        <span
          className="text-[11px] font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5"
          style={{ background: `${STATUS_COLORS[lastStatus]}22`, color: STATUS_COLORS[lastStatus] }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[lastStatus] }} />
          {lastStatus.replace("_", " ")}
        </span>
      </div>
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <LegendItem color={PINK} label="Execution" />
        <LegendItem dashed stroke={EXPECTED} label="Should be" />
        <LegendItem stroke={RESULT} label="Results" />
        <LegendItem dot color={ACCENT} label="Today" />
      </div>

      <div className="relative">
        <div className="absolute inset-0" style={{
          pointerEvents: "none",
          background: `linear-gradient(45deg, transparent, ${ACCENT}10, transparent)`,
          transform: "rotate(45deg)",
          width: "200%",
          height: "200%",
          top: "-50%",
          left: "-50%",
          animation: "chartGlow 6s ease-in-out infinite"
        }}></div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${hDesktop}`}
          className="w-full h-auto sm:block"
          style={{ minHeight: `${hMobile}px`, position: "relative", zIndex: 10 }}
          role="img"
          aria-label={`Progress from day 1 to ${today}. Current score ${Math.round(liveScore)}%, expected ${Math.round(expectedToday)}%. Status ${lastStatus}.`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverDay(null)}
        >
          {/* Horizontal gridlines, dashed faint */}
          {gridLines.map((pct) => (
            <g key={pct}>
              <line
                x1={pad.left} y1={y(pct)} x2={w - pad.right} y2={y(pct)}
                stroke="rgba(229,246,240,0.07)" strokeWidth="1" strokeDasharray="2 3"
              />
              <text
                x={pad.left - 6}
                y={y(pct)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#5A756E"
                fontSize="7"
                fontWeight="600"
              >
                {pct}%
              </text>
            </g>
          ))}

          {/* Area fill under the actual/executed line */}
          <path d={areaPath} fill="rgba(219,96,136,0.10)" />

          {/* Should be: dashed grey, straight 0% → 100% pace */}
          <path d={expectedPath} stroke={EXPECTED} strokeWidth="1" strokeDasharray="4 6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />

          {/* Results line */}
          <path d={resultsPath} stroke={RESULT} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />

          {/* Execution progress line: solid pink, only through actual progress days */}
          {execSteps.length > 1 ? (
            <path d={actualPath} stroke={PINK} strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}

          {/* Execution dots: day-1 start point + days progress was actually made */}
          {(() => {
            const dotDays = new Map();
            for (const p of points) {
              if (showLiveToday && p.day === today) continue;
              dotDays.set(p.day, p.value);
            }
            const day1Val = points.find((p) => p.day === 1)?.value ?? 0;
            if (!dotDays.has(1)) dotDays.set(1, day1Val);
            return [...dotDays].map(([day, val]) => (
              <circle key={`e-${day}`} cx={x(day)} cy={y(val)} r="1.8" fill={PINK} stroke="#0E1817" strokeWidth="1" />
            ));
          })()}

          {/* Results dots: only on days a result was actually logged */}
          {points
            .filter((p) => typeof p.results === "number" && !(showLiveToday && p.day === today))
            .map((p) => (
              <circle key={`r-${p.day}`} cx={x(p.day)} cy={y(p.results)} r="1.8" fill={RESULT} stroke="#0E1817" strokeWidth="1" />
            ))}

          {/* Today's live points: only while the current day is in progress */}
          {showLiveToday ? (
            <>
              {/* Execution: pink with turquoise border */}
              <circle cx={x(today)} cy={y(liveScore)} r="3" fill={PINK} stroke={ACCENT} strokeWidth="1" />
              {/* Expected: centered on the should-be line */}
              <circle cx={x(today)} cy={y(expectedToday)} r="2.4" fill={ACCENT} stroke="#0E1817" strokeWidth="1" />
              {/* Results */}
              <circle cx={x(today)} cy={y(resultsPct)} r="2.2" fill={RESULT} stroke="#0E1817" strokeWidth="1" />
            </>
          ) : null}

          {/* X-axis ticks */}
          {ticks.map((d) => (
            <text key={d} x={x(d)} y={hDesktop - 4} textAnchor="middle" fill="#5A756E" fontSize="7" fontWeight="600">
              {d}
            </text>
          ))}

          {/* Tooltip */}
          {tooltip && (() => {
            const d = hoverDay;
            const rows = [
              { label: "Should be", value: `${tooltip.expected}%`, color: EXPECTED },
              { label: "Execution", value: tooltip.hasLog && tooltip.actual != null ? `${Math.round(tooltip.actual)}%` : "—", color: PINK },
              { label: "Results", value: `${tooltip.results}%`, color: RESULT },
            ];
            const tx = Math.min(Math.max(x(d), 60), w - 78);
            const ty = 6;
            const rowH = 16;
            return (
              <g>
                <rect x={tx - 62} y={ty} width="124" height={54 + rows.length * rowH} rx="8" fill="#102221" stroke="rgba(229,246,240,0.1)" />
                <text x={tx} y={ty + 14} textAnchor="middle" fill="#E5F6F0" fontSize="10" fontWeight="700">
                  Day {d}
                </text>
                {rows.map((r, i) => (
                  <g key={r.label}>
                    <line x1={tx - 54} x2={tx - 42} y1={ty + 25 + i * rowH} y2={ty + 25 + i * rowH} stroke={r.color} strokeWidth="1" strokeLinecap="round" />
                    <text x={tx - 36} y={ty + 28 + i * rowH} textAnchor="start" fill="#8FA8A3" fontSize="9">
                      {r.label}
                    </text>
                    <text x={tx + 32} y={ty + 28 + i * rowH} textAnchor="end" fill={r.color} fontSize="9" fontWeight="700">
                      {r.value}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>

        {/* Add a motivational message based on status */}
      </div>
      <div className="mt-3 text-center text-sm text-text-tertiary">
        {lastStatus === "AHEAD" && (
          <>
            You're ahead of schedule! Keep up the great work!{" "}
            <IconBolt size={14} style={{ color: "var(--color-accent)", display: "inline", verticalAlign: "-2px" }} />
          </>
        )}
        {lastStatus === "BEHIND" && (
          <>
            <span style={{ color: "var(--color-danger)" }}>You're behind schedule. Every action counts - get back on track!</span>{" "}
            <IconFire size={14} style={{ color: "var(--color-danger)", display: "inline", verticalAlign: "-2px" }} />
          </>
        )}
        {lastStatus === "ON TRACK" && (
          <>
            You're right on track! Stay consistent to reach your goals.{" "}
            <IconCheckCircle size={14} style={{ color: "var(--color-accent)", display: "inline", verticalAlign: "-2px" }} />
          </>
        )}
      </div>
    </section>
  );
}

function LegendItem({ color, label, stroke, dot, dashed }) {
  return (
    <div className="flex items-center gap-2">
      {dot ? (
        <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}55` }} />
      ) : (
        <span
          className="w-5 inline-block"
          style={
            dashed
              ? { borderTop: `1px dashed ${stroke || "currentColor"}`, borderSpacing: "2px" }
              : { borderTop: `1px solid ${stroke || color}` }
          }
        />
      )}
      <span className="text-[10px] font-semibold tracking-wide" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
    </div>
  );
}
