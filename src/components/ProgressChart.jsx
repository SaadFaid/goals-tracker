import { useRef, useState } from "react";
import { userData } from "../data/goals";
import { useGoalsStore } from "../store/useGoalsStore";

const ACCENT = "#6DF5E3"; // mint — expected pace
const RESULT = "#FFA14D"; // orange — results progress
const PINK = "#DB6088"; // pink — actual/executed progress

function aggregateResultsPct(categories) {
  const all = (categories || []).filter((c) => !c.isRewards);
  let totalWeight = 0;
  let weightedSum = 0;
  for (const cat of all) {
    for (const r of cat.results || []) {
      if (r.target > 0) {
        const w = r.weight || 0;
        totalWeight += w;
        const pct = Math.min((r.current / r.target) * 100, 100);
        weightedSum += pct * w;
      }
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// Upward progress chart (0 → 100%):
//  - Actual: daily quality score from ProgressLogs (ascending), live today point.
//  - Expected: dashed pace line that reaches 100% on the last day.
//  - Results: aggregate result completion line.
export default function ProgressChart({ logs, dashboard }) {
  const selectedMonth = useGoalsStore((s) => s.selectedMonth);
  const w = 480;
  const hMobile = 180;
  const hDesktop = 220;
  const pad = { top: 12, right: 12, bottom: 26, left: 12 };
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
      dateKey: `${l.year}-${l.month}-${l.dayOfMonth}`,
    }))
    .filter((p) => (Number(p.dateKey.split("-")[0]) === viewYear && Number(p.dateKey.split("-")[1]) === viewMonth))
    .filter((p) => p.day >= 1 && p.day <= totalDays)
    .sort((a, b) => a.day - b.day);

  // Today / live point: use the real quality score from dashboard, not synthetic logs.
  const today = points.length ? points[points.length - 1].day : 1;
  const liveScore = dashboard?.stats?.qualityPercent ?? (points.length ? points[points.length - 1].value : 0);

  const x = (day) => pad.left + ((day - 1) / (totalDays - 1)) * cw;
  const y = (pct) => pad.top + ch - (Math.max(0, Math.min(pct, 100)) / 100) * ch;

  // Expected pace: reaches 100% on the last day.
  const expectedPath = `M ${x(1)} ${y((1 / totalDays) * 100)} L ${x(totalDays)} ${y(100)}`;

  // Actual progress: line from day 1 (0%) through all logged points to today.
  const allPoints = [...points, { day: today, value: liveScore }];
  const actualPath = allPoints.length <= 1
    ? `M ${x(1)} ${y(0)} L ${x(today)} ${y(liveScore)}`
    : `M ${x(1)} ${y(0)} ` + allPoints.map((p) => `L ${x(p.day)} ${y(p.value)}`).join(" ");

  // Area fill under the actual line.
  const areaPath = allPoints.length <= 1
    ? `M ${x(1)} ${y(0)} L ${x(today)} ${y(liveScore)} L ${x(today)} ${y(0)} Z`
    : `M ${x(1)} ${y(0)} ` + allPoints.map((p) => `L ${x(p.day)} ${y(p.value)}`).join(" ") + ` L ${x(today)} ${y(0)} Z`;

  // Results line: starts at 0% on day 1, jumps to current resultsPct today.
  const resultsPath = `M ${x(1)} ${y(0)} L ${x(today)} ${y(0)} L ${x(today)} ${y(resultsPct)}`;

  const ticks = [5, 10, 15, 20, 25, 30];
  const allDays = Array.from({ length: today }, (_, i) => i + 1);
  const gridLines = [25, 50, 75, 100];

  const expectedToday = (today / totalDays) * 100;
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
        const expected = Math.round((hoverDay / totalDays) * 100);
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
      border: "1px solid var(--color-border-active)"
    }}>
      <div className="flex items-center gap-5 mb-3 flex-wrap">
        <LegendItem color={PINK} label="Execution" />
        <LegendItem dashed stroke={ACCENT} label="Should be" />
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
              <text x={pad.left} y={y(pct) - 3} fill="#5A756E" fontSize="9">
                {pct}%
              </text>
            </g>
          ))}

          {/* Area fill under the actual/executed line */}
          <path d={areaPath} fill="rgba(219,96,136,0.08)" />

          {/* Expected pace: dashed mint ascending to 100% */}
          <path d={expectedPath} stroke={ACCENT} strokeWidth="2.5" strokeDasharray="4 4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />

          {/* Results line */}
          <path d={resultsPath} stroke={RESULT} strokeWidth="1.5" fill="none" opacity="0.9" />

          {/* Actual/executed progress line: solid pink */}
          {today > 1 ? (
            <path d={actualPath} stroke={PINK} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}

          {/* Real historical points (past logged days) — pink with turquoise border */}
          {points.map((p) => (
            <circle key={p.dateKey} cx={x(p.day)} cy={y(p.value)} r="2.5" fill={PINK} stroke={ACCENT} strokeWidth="0.75" />
          ))}

          {/* Results dots: 0% for each day until today, then jump to resultsPct */}
          {allDays.map((d) => (
            <circle key={`r-${d}`} cx={x(d)} cy={y(d < today ? 0 : resultsPct)} r="2.5" fill={RESULT} stroke="#0E1817" strokeWidth="0.75" />
          ))}

          {/* Results point at today */}
          <circle cx={x(today)} cy={y(resultsPct)} r="3" fill={RESULT} stroke="#0E1817" strokeWidth="1" />

          {/* Today's live point: pink with turquoise border */}
          {today >= 1 ? (
            <circle cx={x(today)} cy={y(liveScore)} r="4" fill={PINK} stroke={ACCENT} strokeWidth="1.5" />
          ) : null}

          {/* Goal dot markers on expected line at every day up to today */}
          {allDays.map((d) => (
            <circle
              key={d}
              cx={x(d)} cy={y((d / totalDays) * 100)} r="2"
              fill={ACCENT} stroke="#0E1817" strokeWidth="0.75"
            />
          ))}

          {/* X-axis ticks */}
          {ticks.map((d) => (
            <text key={d} x={x(d)} y={hDesktop - 4} textAnchor="middle" fill="#5A756E" fontSize="11">
              {d}
            </text>
          ))}

          {/* Tooltip */}
          {tooltip && (() => {
            const d = hoverDay;
            const rows = [
              { label: "Should be", value: `${tooltip.expected}%`, color: ACCENT },
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
                    <line x1={tx - 54} x2={tx - 42} y1={ty + 25 + i * rowH} y2={ty + 25 + i * rowH} stroke={r.color} strokeWidth="3" strokeLinecap="round" />
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
        <div className="absolute bottom-4 left-4 right-4 text-center text-sm text-text-tertiary pointer-events-none">
          {lastStatus === "AHEAD" && (
            <>
              You're ahead of schedule! Keep up the great work!{" "}
              <span className="text-accent">🚀</span>
            </>
          )}
          {lastStatus === "BEHIND" && (
            <>
              <span style={{ color: "var(--color-danger)" }}>You're behind schedule. Every action counts - get back on track!</span>{" "}
              <span style={{ color: "var(--color-danger)" }}>💪</span>
            </>
          )}
          {lastStatus === "ON TRACK" && (
            <>
              You're right on track! Stay consistent to reach your goals.{" "}
              <span className="text-accent">✅</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function LegendItem({ color, label, stroke, dot, dashed }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot ? (
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      ) : (
        <span
          className="w-4 inline-block"
          style={
            dashed
              ? { borderTop: `1.5px dashed ${stroke || "currentColor"}` }
              : { borderTop: `2px solid ${stroke || color}` }
          }
        />
      )}
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}
