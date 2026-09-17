import { useEffect, useMemo, useState } from "react";
import { userData } from "../data/goals";
import { aggregateResultsPct, computeOverallPct } from "../lib/score";

const TRACK = "rgba(255, 255, 255, 0.10)";
const EXECUTION = "#8FA8A3"; // grey — execution
const MONEY = "var(--color-gold)"; // gold — money
const RESULTS = "var(--color-turquoise)"; // turquoise — results
const EXPECTED = "#B4C2BD"; // small grey expected marker

export default function StatsBar({ cats }) {
  const [moneyHidden, setMoneyHidden] = useState(true);

  const stats = useMemo(() => {
    const actives = (cats || []).filter((c) => !c.isRewards);
    const totalActions = actives.reduce(
      (sum, c) => sum + (c.actions || []).filter((a) => !a._deleted).length,
      0
    );
    const hitCount = actives.reduce(
      (sum, c) =>
        sum +
        (c.actions || [])
          .filter((a) => !a._deleted && a.target > 0 && a.current >= a.target)
          .length,
      0
    );

    const score = Math.round(computeOverallPct(cats));
    const resultsPct = Math.round(aggregateResultsPct(cats));

    // Money dashboard: sum every "$"-unit result across ALL categories so any
    // money added anywhere reflects in the Money stat.
    const moneyItems = (cats || [])
      .flatMap((c) => c.results || [])
      .filter((r) => r.unit === "$");
    const moneyCurrent = moneyItems.reduce((s, r) => s + (r.current || 0), 0);
    const moneyTarget = moneyItems.reduce((s, r) => s + (r.target || 0), 0) || 1000;
    const moneyPct = moneyTarget > 0 ? Math.min(Math.round((moneyCurrent / moneyTarget) * 100), 100) : 0;

    const expectedPct = Math.round((userData.daysPassed / userData.totalDays) * 100);

    return [
      {
        key: "execution",
        label: "Execution",
        pct: score,
        center: `${score}%`,
        sub: `${hitCount} / ${totalActions} actions`,
        color: EXECUTION,
      },
      {
        key: "money",
        label: "Money",
        pct: moneyPct,
        center: moneyHidden ? "***$" : `$${moneyCurrent}`,
        sub: moneyHidden ? "of ***$" : `of $${moneyTarget}`,
        color: MONEY,
        maskable: true,
      },
      {
        key: "results",
        label: "Results",
        pct: resultsPct,
        center: `${resultsPct}%`,
        sub: "tracked · scored",
        color: RESULTS,
      },
    ].map((s) => ({ ...s, expectedPct }));
  }, [cats, moneyHidden]);

  return (
    <div
      className="card card-lift flex items-center justify-center gap-6 sm:gap-14 px-4 py-5"
      style={{
        background: "linear-gradient(90deg, var(--color-elevated), var(--color-surface))",
        border: "1px solid var(--color-border-active)",
      }}
    >
      {stats.map((s) => (
        <StatRing
          key={s.key}
          {...s}
          masked={moneyHidden}
          onToggleMask={s.maskable ? () => setMoneyHidden((v) => !v) : undefined}
        />
      ))}
    </div>
  );
}

function StatRing({ label, center, sub, pct, color, expectedPct, maskable, masked, onToggleMask }) {
  const size = 96;
  const stroke = 3;
  const r = (size - stroke) / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const clamped = Math.max(0, Math.min(100, animated));
  const expAngle = (Math.max(0, Math.min(100, expectedPct)) / 100) * 2 * Math.PI - Math.PI / 2;
  const ex = cx + r * Math.cos(expAngle);
  const ey = cy + r * Math.sin(expAngle);

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0 }}
        >
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - clamped / 100)}
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          </g>
          {/* Start marker at 12 o'clock */}
          <circle cx={cx} cy={cy - r} r="1.5" fill={color} />
          {/* Small grey point at the expected position */}
          <circle cx={ex} cy={ey} r="1.5" fill={EXPECTED} />
        </svg>
        <div className="stat-num" style={{ color: "#FFFFFF", fontWeight: 700, fontSize: center.length > 5 ? 15 : 18 }}>
          {center}
        </div>
      </div>
      <div
        className="mt-2 text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </div>
      <div className="flex items-center gap-1 text-[9px]" style={{ color: "var(--color-text-tertiary)" }}>
        <span>{sub}</span>
        {maskable && (
          <button
            type="button"
            onClick={onToggleMask}
            className="cursor-pointer transition-colors"
            style={{ color: "var(--color-text-tertiary)" }}
            title={masked ? "Show amount" : "Hide amount"}
            aria-label={masked ? "Show amount" : "Hide amount"}
          >
            <EyeIcon off={masked} />
          </button>
        )}
      </div>
    </div>
  );
}

function EyeIcon({ off }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}