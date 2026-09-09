import { actionPct, resultPct } from "../lib/score";

function Section({ title, emoji, color, items }) {
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <div className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color }}>
        <span>{emoji}</span> {title}
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <span className="font-medium text-white truncate">{it.name}</span>
            <span className="text-[10px] opacity-50">· {it.cat}</span>
            <span className="ml-auto text-[10px] font-mono" style={{ color }}>{Math.round(it.pct)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getAnalysis(cats) {
  const good = [];
  const bad = [];
  const doingWell = [];
  const needsWork = [];

  for (const cat of cats) {
    const actions = (cat.actions || []).filter((a) => !a._deleted);
    const results = (cat.results || []).filter((r) => !r._deleted);

    for (const a of actions) {
      const pct = actionPct(a);
      const item = { name: a.label, cat: cat.label, pct };
      if (pct >= 80) good.push(item);
      if (pct < 40) bad.push(item);
      if (pct >= 60) doingWell.push(item);
      if (pct < 60) needsWork.push(item);
    }

    for (const r of results) {
      const pct = resultPct(r);
      const item = { name: r.label, cat: cat.label, pct };
      if (pct >= 80) good.push(item);
      if (pct < 40) bad.push(item);
      if (pct >= 60) doingWell.push(item);
      if (pct < 60) needsWork.push(item);
    }
  }

  return { good, bad, doingWell, needsWork };
}

export default function MonthEndAnalysis({ cats, onClose }) {
  const { good, bad, doingWell, needsWork } = getAnalysis(cats);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5 border border-white/10" style={{ background: "#0E1817" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Month Analysis</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white/50 text-sm w-6 h-6 flex items-center justify-center">
            ×
          </button>
        </div>

        {!good.length && !bad.length && (
          <div className="text-center text-sm text-white/40 py-8">No data yet for this month.</div>
        )}

        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          <Section title="Killing it" emoji="🟢" color="#6DF5E3" items={good} />
          <Section title="Doing well" emoji="🔵" color="#77B5E8" items={doingWell} />
          <Section title="Needs work" emoji="🟠" color="#FFA14D" items={needsWork} />
          <Section title="Slipping" emoji="🔴" color="#DB6088" items={bad} />
        </div>
      </div>
    </div>
  );
}
