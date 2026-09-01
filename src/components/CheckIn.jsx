import { useState } from "react";
import { actionPct, resultPct } from "../lib/score";

const isKgResult = (item) =>
  item.resultType === "check" || item.invert || String(item.unit || "").toLowerCase().includes("kg");

export default function CheckIn({ categories, onIncrement, onDecrement, onResultToggle }) {
  const [open, setOpen] = useState(false);

  const rows = [];
  (categories || []).forEach((cat) => {
    if (cat.isRewards) return;
    const color = cat.dotColor === "white" ? "#fff" : "var(--color-accent)";
    (cat.actions || []).forEach((a, i) => {
      if (a._deleted) return;
      rows.push({ type: "action", catId: cat.id, idx: i, item: a, color });
    });
    (cat.results || []).forEach((r, i) => {
      if (r._deleted) return;
      rows.push({ type: "result", catId: cat.id, idx: i, item: r, color, isKg: isKgResult(r) });
    });
  });

  const notDone = (r) =>
    r.type === "result" ? resultPct(r.item) < 100 : r.item.current < r.item.target;
  const openCount = rows.filter(notDone).length;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
          className="flex items-center justify-center rounded-full px-3 py-3 font-bold"
          style={{
            background: "var(--color-navy-600)",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-subtle)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm"
          style={{
            background: "var(--color-accent)",
            color: "#101010",
            boxShadow: "0 6px 24px rgba(109,245,227,0.4)",
          }}
          aria-label="Open check-in"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 12l2 2 4-4" />
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
          Check in
          {openCount > 0 && (
            <span className="grid place-items-center min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold" style={{ background: "#101010", color: "var(--color-accent)" }}>
              {openCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,31,30,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[520px] max-h-[84vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: "var(--color-elevated)", border: "1px solid var(--color-border-active)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <h2 className="display text-heading text-lg">Check in</h2>
              <button onClick={() => setOpen(false)} aria-label="Close check-in" className="text-text-tertiary cursor-pointer text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {rows.length === 0 ? (
                <p className="text-text-tertiary text-sm text-center py-8">No actions or results yet. Add some to start.</p>
              ) : openCount === 0 ? (
                <p className="text-text-tertiary text-sm text-center py-8">All caught up — everything is done. 🎉</p>
              ) : (
                rows.filter(notDone).map((r) => (
                  <CheckInRow key={`${r.type}-${r.item.id}`} row={r} onIncrement={onIncrement} onDecrement={onDecrement} onResultToggle={onResultToggle} />
                ))
              )}
            </div>

            <div className="px-4 py-3" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
              <button
                onClick={() => setOpen(false)}
                className="w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: "var(--color-accent)", color: "#101010" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CheckInRow({ row, onIncrement, onDecrement, onResultToggle }) {
  const { type, catId, idx, item, color, isKg } = row;
  const pct = type === "result" ? resultPct(item) : actionPct(item);
  const done = type === "result" ? pct >= 100 : item.current >= item.target;

  // Check-type items (yes/no): a checkbox you can check or uncheck instead of a %.
  const isCheck = type === "action"
    ? item.actionType === "check"
    : (item.resultType || (item.invert ? "check" : "count")) === "check";
  if (isCheck) {
    const toggle = () => {
      if (type === "result") {
        if (onResultToggle) onResultToggle(catId, idx, !done);
      } else {
        onIncrement(done ? -item.current : (item.target - item.current));
      }
    };
    return (
      <div
        className="flex items-center gap-2 rounded-xl p-1.5 cursor-pointer"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)" }}
        onClick={toggle}
      >
        <span
          className="grid place-items-center shrink-0"
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: done ? "var(--color-accent)" : "transparent",
            border: "2px solid " + (done ? "var(--color-accent)" : "var(--color-border-active)"),
          }}
        >
          {done && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4 10-10" stroke="#101010" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="flex-1">
          <span className="block text-sm font-medium" style={{ color: "var(--color-heading)", textDecoration: done ? "line-through" : undefined, opacity: done ? 0.6 : 1 }}>
            {item.label}
          </span>
          <span className="block text-xs mono text-text-tertiary mt-0.5">
            {item.current}{item.unit} / {item.target}{item.unit}
          </span>
        </span>
        <span className="mono text-xs font-semibold shrink-0" style={{ color: done ? "var(--color-accent)" : "var(--color-text-tertiary)" }}>
          {done ? "done" : "not yet"}
        </span>
      </div>
    );
  }

  // kg/invert results: simple checkbox (done / not) instead of a %.
  if (type === "result" && isKg) {    return (
      <div
        className="flex items-center gap-2 rounded-xl p-1.5 cursor-pointer"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)" }}
        onClick={() => onResultToggle && onResultToggle(catId, idx, !done)}
      >
        <span
          className="grid place-items-center shrink-0"
          style={{
            width: 22, height: 22, borderRadius: 6,
            background: done ? "var(--color-accent)" : "transparent",
            border: "2px solid " + (done ? "var(--color-accent)" : "var(--color-border-active)"),
          }}
        >
          {done && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4 10-10" stroke="#101010" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="flex-1">
          <span className="block text-sm font-medium" style={{ color: "var(--color-heading)", textDecoration: done ? "line-through" : undefined, opacity: done ? 0.6 : 1 }}>
            {item.label}
          </span>
          <span className="block text-xs mono text-text-tertiary mt-0.5">
            {item.current}{item.unit} / {item.target}{item.unit}
          </span>
        </span>
        <span className="mono text-xs font-semibold shrink-0" style={{ color: done ? "var(--color-accent)" : "var(--color-text-tertiary)" }}>
          {done ? "done" : "not yet"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-xl p-1.5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <button
        onClick={() => onIncrement(catId, idx)}
        className="flex flex-1 items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-transform active:scale-[0.99] cursor-pointer"
      >
        <span className="relative grid place-items-center shrink-0" style={{ width: 28, height: 28, borderRadius: "50%" }}>
          {done && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="absolute">
              <path d="M5 13l4 4 10-10" stroke="#101010" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className="absolute" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--color-border-active)" strokeWidth="2.5" />
            {pct > 0 && (
              <circle
                cx="12" cy="12" r="9.5" fill="none"
                stroke={pct >= 100 ? "var(--color-accent)" : color}
                strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * (2 * Math.PI * 9.5)} ${2 * Math.PI * 9.5}`}
              />
            )}
          </svg>
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="block text-sm font-medium" style={{ color: "var(--color-heading)", textDecoration: done ? "line-through" : undefined, opacity: done ? 0.6 : 1 }}>
              {item.label}
            </span>
          </span>
          <span className="block text-xs mono text-text-tertiary mt-0.5">
            {item.current} / {item.target}{item.unit}
          </span>
        </span>
        <span className="mono text-xs font-semibold shrink-0" style={{ color: "var(--color-accent)" }}>
          {Math.round(pct)}%
        </span>
      </button>
      {!done && onDecrement && type === "action" && (
        <button
          onClick={() => onDecrement(catId, idx)}
          title="Remove one"
          aria-label={`Remove one: ${item.label}`}
          className="stepper-btn shrink-0 w-9 h-9"
          style={{
            borderRadius: 10,
            color: "var(--color-text-secondary)",
            background: "var(--color-sunken)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >−</button>
      )}
    </div>
  );
}
