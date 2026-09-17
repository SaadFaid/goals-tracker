import { useEffect, useMemo, useState } from "react";
import { aggregateResultsPct, computeOverallPct } from "../lib/score";
import { useCountUp } from "../lib/hooks";

const TRACK = "rgba(255, 255, 255, 0.10)";
const EXECUTION = "#8FA8A3"; // grey  — execution
const MONEY = "var(--color-gold)"; // gold   — money
const RESULTS = "var(--color-turquoise)"; // turquoise — results

export default function StatsBar({ cats }) {
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
      .flatMap((c) => (c.results || []))
      .filter((r) => r.unit === "$");
    const moneyCurrent = moneyItems.reduce((s, r) => s + (r.current || 0), 0);
    const moneyTarget = moneyItems.reduce((s, r) => s + (r.target || 0), 0) || 1000;
    const moneyPct = moneyTarget > 0 ? Math.min(Math.round((moneyCurrent / moneyTarget) * 100), 100) : 0;

    return [
      {
        key: "execution",
        label: "Execution",
        value: score,
        suffix: "%",
        pct: score,
        sub: `${hitCount} / ${totalActions} actions`,
        color: EXECUTION,
      },
      {
        key: "money",
        label: "Money",
        value: moneyCurrent,
        prefix: "$",
        pct: moneyPct,
        sub: `of $${moneyTarget}`,
        color: MONEY,
      },
      {
        key: "results",
        label: "Results",
        value: resultsPct,
        suffix: "%",
        pct: resultsPct,
        sub: "tracked · scored",
        color: RESULTS,
      },
    ];
  }, [cats]);

  return (
    <div
      className="card card-lift flex items-center justify-center gap-4 sm:gap-12 px-4 py-5"
      style={{
        background: "var(--color-panel-navy)",
        border: "1px solid var(--color-border-active)",
      }}
    >
      {stats.map((s) => (
        <StatRing key={s.key} {...s} />
      ))}
    </div>
  );
}

function StatRing({ label, value, prefix = "", suffix = "", pct, sub, color }) {
  const size = 84;
  const stroke = 9;
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
            {/* Full-circle track, same stroke width as the arc */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
            {/* Colored arc, rounded caps */}
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
          {/* Single start marker at 12 o'clock */}
          <circle cx={cx} cy={cy - r} r="1.5" fill={color} />
        </svg>
        <CountUpNumber value={value} prefix={prefix} suffix={suffix} />
      </div>
      <div
        className="mt-2 text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{ color: "var(--color-label-blue)" }}
      >
        {label}
      </div>
      <div className="text-[9px]" style={{ color: "var(--color-text-tertiary)" }}>
        {sub}
      </div>
    </div>
  );
}

function CountUpNumber({ value, prefix = "", suffix = "" }) {
  const animated = useCountUp(value, 300);
  const rendered = Number.isFinite(animated) ? Math.round(animated) : value;
  const text = `${prefix}${rendered}${suffix}`;
  const fontSize = text.length > 5 ? 15 : 18;
  return (
    <div className="stat-num" style={{ color: "#FFFFFF", fontWeight: 700, fontSize }}>
      {text}
    </div>
  );
}