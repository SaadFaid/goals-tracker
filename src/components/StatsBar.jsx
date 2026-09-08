import { useEffect, useMemo, useState } from "react";
import { userData } from "../data/goals";
import { computeOverallPct } from "../lib/score";

import { useCountUp } from "../lib/hooks";

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
    const resultsCurrent = actives.reduce(
      (s, c) => s + (c.results || []).reduce((a, r) => a + (r.current || 0), 0),
      0
    );
    const resultsTarget = actives.reduce(
      (s, c) => s + (c.results || []).reduce((a, r) => a + (r.target || 0), 0),
      0
    );
    const resultsPct = resultsTarget > 0 ? Math.round((resultsCurrent / resultsTarget) * 100) : 0;

    const score = Math.round(computeOverallPct(cats));
    // Money dashboard: sum every "$"-unit result across ALL categories so any
    // money added anywhere reflects in the Money stat.
    const moneyItems = (cats || [])
      .flatMap((c) => (c.results || []))
      .filter((r) => r.unit === "$");
    const moneyCurrent = moneyItems.reduce((s, r) => s + (r.current || 0), 0);
    const moneyTarget = moneyItems.reduce((s, r) => s + (r.target || 0), 0) || 1000;
    const moneyPct = moneyTarget > 0 ? Math.min(Math.round((moneyCurrent / moneyTarget) * 100), 100) : 0;

    const dayOfMonth = userData.daysPassed;
    const daysPct = Math.round((dayOfMonth / userData.totalDays) * 100);

    return [
      {
        label: "Execution",
        value: score,
        suffix: "%",
        prefix: "",
        pct: score,
        sub: `${hitCount} / ${totalActions} actions hit · your score`,
        tint: "accent",
        icon: "⚡",
      },
      {
        label: "Results",
        value: resultsPct,
        suffix: "%",
        prefix: "",
        pct: resultsPct,
        sub: "tracked · scored",
        tint: "neutral",
        icon: "📊",
      },
      {
        label: "Money",
        value: moneyCurrent,
        suffix: "",
        prefix: "$",
        pct: moneyPct,
        sub: `target $${moneyTarget}`,
        tint: "accent",
        icon: "💰",
      },
      {
        label: "Day",
        value: dayOfMonth,
        suffix: "",
        prefix: "",
        pct: daysPct,
        sub: `of ${userData.totalDays} in ${userData.month}`,
        tint: "neutral",
        icon: "📅",
      },
    ];
  }, [cats]);

  return (
    <div
      className="card card-lift grid grid-cols-2 gap-y-4 md:grid-cols-4 overflow-hidden"
      style={{
        background: "linear-gradient(90deg, var(--color-elevated), var(--color-surface))",
        border: "1px solid var(--color-border-active)",
      }}
    >
      {stats.map((s) => (
        <div key={s.label} className="py-4 px-1 text-center">
          <div className="flex flex-col items-center">
            <div className="text-[18px] mb-1">{s.icon}</div>
            <ProgressRing pct={s.pct} tint={s.tint}>
              <CountUpNumber {...s} />
            </ProgressRing>
            <div className="caption text-text-tertiary mt-1.5 !normal-case !text-[10px]">{s.label}</div>
            <div className="text-[10px] text-text-tertiary mt-0.5">{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressRing({ pct, tint, children }) {
  const size = 76;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const clamped = Math.max(0, Math.min(100, animated));
  const color = tint === "accent" ? "var(--color-accent)" : "var(--color-text-primary)";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border-active)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - clamped / 100)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function CountUpNumber({ value, suffix, prefix, tint }) {
  const animated = useCountUp(value, 300);
  const rendered = Number.isFinite(animated) ? Math.round(animated) : value;
  const color = tint === "accent" ? "var(--color-accent)" : "var(--color-text-primary)";
  const text = `${prefix}${rendered}${suffix}`;
  const fontSize = text.length > 5 ? 17 : 21;
  return (
    <div className="stat-num" style={{ color, fontWeight: 600, fontSize }}>
      {text}
    </div>
  );
}