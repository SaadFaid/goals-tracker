import { useMemo } from "react";
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
    const daysLeft = userData.totalDays - userData.daysPassed;

    return [
      { 
        label: "Execution", 
        value: score, 
        suffix: "%", 
        prefix: "", 
        sub: `${hitCount} / ${totalActions} actions hit · your score`, 
        tint: "accent" ,
        icon: "⚡"
      },
      { 
        label: "Results", 
        value: resultsPct,
        suffix: "%", 
        prefix: "", 
        sub: "tracked · scored", 
        tint: "neutral" ,
        icon: "📊"
      },
      { 
        label: "Money", 
        value: moneyCurrent, 
        suffix: "", 
        prefix: "$", 
        sub: `target $${moneyTarget}`, 
        tint: "accent" ,
        icon: "💰"
      },
      { 
        label: "Days Left", 
        value: daysLeft, 
        suffix: "", 
        prefix: "", 
        sub: `of ${userData.totalDays} in ${userData.month}`, 
        tint: "neutral" ,
        icon: "📅"
      },
    ];
  }, [cats]);

  return (
    <div className="card card-lift flex overflow-hidden" style={{ 
      background: "linear-gradient(90deg, var(--color-elevated), var(--color-surface))",
      border: "1px solid var(--color-border-active)" 
    }}>
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`flex-1 py-4 px-1 text-center ${
            i < stats.length - 1 ? "border-r" : ""
          }`}
          style={{ 
            borderColor: "var(--color-border-active)",
            background: i % 2 === 0 ? "var(--color-elevated)" : "var(--color-surface)"
          }}
        >
          <div className="flex flex-col items-center">
            <div className="text-[18px] mb-1">{s.icon}</div>
            <CountUpNumber {...s} />
            <div className="caption text-text-tertiary mt-0.5 !normal-case !text-[10px]">{s.label}</div>
            <div className="text-[10px] text-text-tertiary mt-0.5">{s.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CountUpNumber({ value, suffix, prefix, tint }) {
  const animated = useCountUp(value, 300);
  const rendered = Number.isFinite(animated) ? Math.round(animated) : value;
  const color = tint === "accent" ? "var(--color-accent)" : "var(--color-text-primary)";
  return (
    <div className="stat-num" style={{ color, fontWeight: 600 }}>
      {prefix}{rendered}{suffix}
    </div>
  );
}
