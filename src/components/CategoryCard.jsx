import { useState, useEffect, useRef, memo } from "react";
import { categoryPct, actionPct, resultPct, categoryWeightsSum, checkRewardUnlock, computeOverallPct } from "../lib/score";
import { useGoalsStore } from "../store/useGoalsStore";
import { CATEGORY_COLORS, dotColorToHex } from "../lib/categoryColors";

const ACCENT = "var(--color-accent)";

function Chevron({ open }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none"
      className={`chevron text-muted ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DragBar({ value, color, label, onChangeFraction }) {
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef(null);

  const updateFromEvent = (e) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChangeFraction(frac);
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    setDragging(true);
    updateFromEvent(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    updateFromEvent(e);
  };

  const endDrag = () => setDragging(false);

  const pct = Math.max(0, Math.min(value, 100));

  return (
    <div
      ref={trackRef}
      className="w-full h-3 rounded-full relative select-none touch-none"
      style={{ background: "var(--color-navy-500)", cursor: dragging ? "grabbing" : "grab" }}
      role="slider"
      aria-label={label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(pct)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="absolute top-1/2 left-0 h-1 rounded-full"
        style={{ width: `${pct}%`, background: color, transform: "translateY(-50%)", opacity: 0.9 }} />
      {/* Draggable point on the line */}
      <div
        className="absolute rounded-full"
        style={{
          left: `${pct}%`,
          top: "50%",
          width: 14,
          height: 14,
          transform: "translate(-50%, -50%)",
          background: "#0E1817",
          border: `2px solid ${color}`,
          boxShadow: dragging
            ? `0 0 0 4px ${color}44, 0 2px 8px rgba(0,0,0,0.5)`
            : `0 1px 4px rgba(0,0,0,0.4)`,
        }}
      />
    </div>
  );
}

function PencilIcon({ show }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      className="pencil-inline inline-block ml-1 text-text-tertiary transition-opacity"
      style={{ opacity: show ? 1 : 0 }}
    >
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      className="text-danger"
    >
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Click-to-edit inline number input. */
function EditableNumber({ value, onChange, ariaLabel }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const num = parseFloat(draft);
    if (!isNaN(num) && num >= 0) onChange(num);
    else setDraft(String(value));
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setDraft(String(value)); }
        }}
        aria-label={ariaLabel}
        className="edit-in w-14 bg-sunken text-right text-xs rounded px-1 py-0.5 outline-none text-heading"
        style={{ border: "1px solid var(--color-accent)", boxShadow: "0 0 0 2px rgba(109,245,227,0.25)" }}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="cursor-pointer rounded px-0.5" title="Click to edit"
    >
      <span className="group inline-flex items-center">
        {value}
        <PencilIcon show={false} />
      </span>
    </span>
  );
}

/** Click-to-edit inline text input. Empty values render a faint "+" so they stay clickable. */
function EditableText({ value, onChange, ariaLabel }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
        }}
        aria-label={ariaLabel}
        className="edit-in w-24 bg-sunken text-xs rounded px-1 py-0.5 outline-none text-heading"
        style={{ border: "1px solid var(--color-accent)", boxShadow: "0 0 0 2px rgba(109,245,227,0.25)" }}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value || ""); setEditing(true); }}
      className="cursor-pointer rounded px-0.5"
      title={value ? "Click to edit" : "Click to add"}
    >
      {value || <span className="text-text-tertiary">+</span>}
    </span>
  );
}

/** Row wrapper with delete confirmation overlay (delete only in edit mode). */
function ConfirmableRow({ children, onDelete, allowDelete }) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(null);

  const requestDelete = () => {
    setConfirming(true);
    timer.current = setTimeout(() => setConfirming(false), 5000);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="row-hover relative rounded px-1 py-1 -mx-1 min-h-[44px]" style={{ position: "relative" }}>
      {children}
      {allowDelete && (
        !confirming ? (
          <button
            onClick={requestDelete}
            aria-label="Delete item"
            title="Remove this task"
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 cursor-pointer text-danger hover:opacity-100 opacity-40 transition-opacity"
          >
            <XIcon />
          </button>
        ) : (
          <div
            className="absolute inset-0 z-10 flex items-center justify-between px-2 rounded"
            style={{ background: "rgba(219,96,136,0.1)", border: "1px solid rgba(219,96,136,0.3)" }}
          >
            <span className="text-xs text-danger">Delete this item?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-muted px-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => { clearTimeout(timer.current); setConfirming(false); onDelete(); }}
                className="text-xs font-semibold px-2.5 py-1 rounded"
                style={{ background: "var(--color-danger)", color: "#fff" }}
              >
                Delete
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/** Generic inline add form. */
function InlineAdd({ label, fields, onSubmit, onCancel }) {
  const [values, setValues] = useState(fields.map((f) => f.init ?? ""));

  const setField = (i, v) => setValues((prev) => prev.map((x, j) => (j === i ? v : x)));

  const submit = (e) => {
    e.preventDefault();
    const data = {};
    fields.forEach((f, i) => { data[f.key] = f.parse ? f.parse(values[i]) : values[i]; });
    onSubmit(data);
  };

  return (
    <form onSubmit={submit} className="slide-down flex flex-col gap-2 mb-2" style={{ background: "var(--color-sunken)", borderRadius: "8px", padding: "12px" }}>
      {fields.map((f, i) =>
        f.type === "select" ? (
          f.customOption ? (
            <div key={f.key} className="flex gap-2">
              <input
                value={values[i]}
                onChange={(e) => setField(i, e.target.value)}
                placeholder={f.placeholder || f.key}
                className="flex-1 bg-elevated text-heading text-sm rounded-lg px-3 py-2 outline-none"
                style={{ border: "1px solid var(--color-border-subtle)" }}
              />
              <select
                value={f.options.some((o) => o.value === values[i]) ? values[i] : ""}
                onChange={(e) => { if (e.target.value) setField(i, e.target.value); }}
                className="bg-elevated text-heading text-sm rounded-lg px-2 py-2 outline-none"
                style={{ border: "1px solid var(--color-border-subtle)" }}
              >
                <option value="" disabled style={{ background: "var(--color-elevated)" }}>Choose…</option>
                {(f.options || []).map((o) => (
                  <option key={o.value} value={o.value} style={{ background: "var(--color-elevated)" }}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <select
              key={f.key}
              value={String(values[i] ?? f.init)}
              onChange={(e) => setField(i, e.target.value)}
              className="w-full bg-elevated text-heading text-sm rounded-lg px-3 py-2 outline-none"
              style={{ border: "1px solid var(--color-border-subtle)" }}
            >
              {(f.options || []).map((o) => (
                <option key={o.value} value={o.value} style={{ background: "var(--color-elevated)" }}>{o.label}</option>
              ))}
            </select>
          )
        ) : (
          <input
            key={f.key}
            value={values[i]}
            onChange={(e) => setField(i, e.target.value)}
            placeholder={f.placeholder || f.key}
            className="w-full bg-elevated text-heading text-sm rounded-lg px-3 py-2 outline-none"
            style={{ border: "1px solid var(--color-border-subtle)" }}
          />
        )
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg text-muted">Cancel</button>
        <button type="submit" className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: ACCENT, color: "#000" }}>
          {label}
        </button>
      </div>
    </form>
  );
}

function CheckCircle({ pct, done, onTap, onOpenMenu }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const pctClamped = Math.max(0, Math.min(pct, 100));
  const ring = (c * pctClamped) / 100;
  const pressTimer = useRef(null);
  const longFired = useRef(false);

  const startPress = () => {
    longFired.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { longFired.current = true; if (onOpenMenu) onOpenMenu(); }, 520);
  };
  const endPress = () => clearTimeout(pressTimer.current);

  return (
    <button
      type="button"
      onClick={(e) => { if (longFired.current) { longFired.current = false; e.preventDefault(); return; } if (onTap) onTap(); }}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => { e.preventDefault(); if (onOpenMenu) onOpenMenu(); }}
      aria-label={done ? "Action complete" : pctClamped > 0 ? "Action in progress" : "Action not started"}
      title="Tap to check off. Long-press for options."
      className="check-circle shrink-0 cursor-pointer relative"
      style={{ width: 24, height: 24, padding: 0, background: "transparent", border: "none", outline: "none" }}
    >
      {done ? (
        <span className="check-pop" style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "var(--color-accent)", border: "2px solid var(--color-accent)",
          display: "grid", placeItems: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4 10-10" stroke="#101010" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="12" cy="12" r={r} fill="none" stroke="var(--color-border-active)" strokeWidth="2" />
          {pctClamped > 0 && (
            <circle cx="12" cy="12" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round"
              strokeDasharray={`${ring} ${c}`} />
          )}
        </svg>
      )}
    </button>
  );
}

function ActionRow({ item, color, onUpdate, onFieldChange, onDelete, onIncrement, editable }) {
  const pct = Math.round(actionPct(item));
  const done = item.current >= item.target;
  const isCheck = item.actionType === "check";
  const [menu, setMenu] = useState(false);

  const bump = (amount) => { onIncrement(amount); setMenu(false); };
  const markDone = () => { onIncrement(item.target - item.current); setMenu(false); };
  const reset = () => { onIncrement(-item.current); setMenu(false); };
  const stepDown = () => { onIncrement(-(item.incrementBy ?? 1)); setMenu(false); };
  const toggleCheck = () => { onIncrement(done ? -item.current : (item.target - item.current)); setMenu(false); };

  const pctLabel = pct >= 100 ? "done" : `${pct}%`;

  return (
    <ConfirmableRow onDelete={onDelete} allowDelete={editable}>
      <div className="flex items-center justify-between text-xs mb-1 pr-6">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle pct={pct} done={done} onTap={isCheck ? toggleCheck : () => onIncrement()} onOpenMenu={editable ? () => setMenu(true) : undefined} />
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span
            className="text-muted truncate transition-all"
            style={done ? { opacity: 0.6, textDecoration: "line-through" } : undefined}
          >
            {editable ? (
              <EditableText value={item.label} onChange={(v) => onFieldChange("label", v)} ariaLabel="Edit action label" />
            ) : (
              item.label
            )}
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 inline-flex items-center gap-0.5"
            style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
            title={editable ? "Click to edit weight" : undefined}
          >
            {editable ? (
              <EditableNumber value={item.weight ?? 0} onChange={(v) => onFieldChange("weight", Math.round(v))} ariaLabel="Edit action weight" />
            ) : (
              item.weight
            )}%
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isCheck ? (
            <>
              <span
                onClick={toggleCheck}
                className="cursor-pointer select-none text-xs font-semibold px-2.5 py-1 rounded-full"
                style={done
                  ? { background: "var(--color-accent-muted)", color: "var(--color-accent)" }
                  : { background: "var(--color-navy-600)", color: "var(--color-text-tertiary)" }}
                title="Tap to toggle"
              >
                {done ? "done ✓" : "not done"}
              </span>
              {editable && menu && (
                <TaskMenu item={item} onFieldChange={onFieldChange} done={done} onMarkDone={markDone} onReset={reset} />
              )}
            </>
          ) : (
            <>
              <span className="text-muted mono text-[11px]">
                <EditableNumber value={item.current} onChange={onUpdate} ariaLabel="Edit action count" />
                {" / "}
                {editable ? (
                  <>
                    <EditableNumber value={item.target} onChange={(v) => onFieldChange("target", v)} ariaLabel="Edit action target" />
                    {item.actionType !== "count" && (
                      <EditableText value={item.unit || ""} onChange={(v) => onFieldChange("unit", v)} ariaLabel="Edit action unit" />
                    )}
                  </>
                ) : (
                  <>{item.target}{item.actionType !== "count" ? item.unit : ""}</>
                )}
              </span>
              <span
                className="text-heading font-semibold mono w-14 text-right"
                style={pct >= 100 ? { color: "var(--color-success)", fontSize: 11 } : undefined}
              >
                {pctLabel}
              </span>
              <button
                onClick={stepDown}
                title="Step down"
                aria-label="Step down"
                className="stepper-btn"
              >−</button>
              {editable && menu && (
                <TaskMenu item={item} onFieldChange={onFieldChange} done={done} onMarkDone={markDone} onReset={reset} bump={bump} />
              )}
            </>
          )}
        </div>
      </div>
      {!isCheck && (
        <div className="pr-6">
          <DragBar
            value={pct}
            color={color}
            label={`${item.label} ${pct} percent`}
            onChangeFraction={(f) => onUpdate(Math.max(0, Math.round(f * item.target)))}
          />
        </div>
      )}
    </ConfirmableRow>
  );
}

const PRECISIONS = [1, 0.1, 0.01, 0.001];

function TaskMenu({ item, onFieldChange, done, onMarkDone, onReset, bump }) {
  const setType = (t) => {
    if (t === "check") onFieldChange("actionType", "check");
    else onFieldChange("actionType", t);
  };
  return (
    <span
      className="absolute z-20 right-6 top-9 flex flex-col gap-1 rounded-lg px-2 py-2 text-[11px]"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-active)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="flex items-center justify-between gap-2 px-1">
        <span className="text-text-tertiary">Type</span>
        <select
          value={item.actionType === "check" ? "check" : item.actionType === "amount" ? "amount" : "count"}
          onChange={(e) => setType(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-sunken text-heading text-[11px] rounded-md px-2 py-1 outline-none"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          <option value="check" style={{ background: "var(--color-elevated)" }}>☑ Checkbox (yes/no)</option>
          <option value="amount" style={{ background: "var(--color-elevated)" }}>Amount (unit)</option>
          <option value="count" style={{ background: "var(--color-elevated)" }}>Count (precision)</option>
        </select>
      </span>
      {item.actionType === "check" ? (
        <>
          <button onClick={onMarkDone} className="stepper-opt" style={{ color: "var(--color-success)" }}>
            {done ? "✓ Mark not done" : "✓ Mark done"}
          </button>
          <button onClick={onReset} className="stepper-opt" style={{ color: "var(--color-danger)" }}>↺ Reset</button>
        </>
      ) : (
        <>
          {bump && (
            <span className="flex items-center gap-1 text-muted">
              <button onClick={() => bump(actionPct(item) >= 100 ? 0 : (item.incrementBy ?? 1))} className="stepper-btn">−</button>
              <span className="mono text-heading w-10 text-center">{item.current}</span>
              <button onClick={() => bump(item.incrementBy ?? 1)} className="stepper-btn">+</button>
            </span>
          )}
          {!bump && (
            <button onClick={onMarkDone} className="stepper-opt" style={{ color: "var(--color-success)" }}>✓ Mark all done</button>
          )}
          <button onClick={onReset} className="stepper-opt" style={{ color: "var(--color-danger)" }}>↺ Reset to 0</button>
          <span className="my-0.5" style={{ borderTop: "1px solid var(--color-border-subtle)" }} />
          {item.actionType === "count" && (
            <span className="flex items-center justify-between gap-2 px-1">
              <span className="text-text-tertiary">Step</span>
              <span className="flex items-center gap-1">
                <select
                  value={item.incrementBy ?? 1}
                  onChange={(e) => onFieldChange("incrementBy", parseFloat(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-sunken text-heading text-[11px] rounded-md px-1 py-0.5 outline-none"
                  style={{ border: "1px solid var(--color-border-subtle)" }}
                >
                  {PRECISIONS.map((p) => (
                    <option key={p} value={p} style={{ background: "var(--color-elevated)" }}>{p}</option>
                  ))}
                </select>
              </span>
            </span>
          )}
        </>
      )}
      <span className="flex items-center justify-between gap-2 px-1">
        <span className="text-text-tertiary">Resets</span>
        <select
          value={item.resetType || "monthly"}
          onChange={(e) => onFieldChange("resetType", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-sunken text-heading text-[11px] rounded-md px-2 py-1 outline-none"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          <option value="none" style={{ background: "var(--color-elevated)" }}>Never</option>
          <option value="daily" style={{ background: "var(--color-elevated)" }}>Daily</option>
          <option value="weekly" style={{ background: "var(--color-elevated)" }}>Weekly</option>
          <option value="monthly" style={{ background: "var(--color-elevated)" }}>Monthly</option>
          <option value="yearly" style={{ background: "var(--color-elevated)" }}>Yearly</option>
        </select>
      </span>
    </span>
  );
}

function ResultRow({ item, color, onUpdate, onFieldChange, onDelete, onIncrement, editable }) {
  const pct = Math.round(resultPct(item));
  const isBadge = !!item.isBadge;
  const isCheck = (item.resultType || (item.invert ? "check" : "count")) === "check";
  const done = isBadge ? item.current >= item.target : pct >= 100;
  const [menu, setMenu] = useState(false);

  const bump = (amount) => { onIncrement(amount); setMenu(false); };
  const markDone = () => { onIncrement(item.target - item.current); setMenu(false); };
  const reset = () => { onIncrement(-item.current); setMenu(false); };
  const toggleCheck = () => { onUpdate(done ? 0 : item.target); setMenu(false); };

  return (
    <ConfirmableRow onDelete={onDelete} allowDelete={editable}>
      <div className="flex items-center justify-between text-xs mb-1 pr-6">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-muted truncate">
            {editable ? (
              <EditableText value={item.label} onChange={(v) => onFieldChange("label", v)} ariaLabel="Edit result label" />
            ) : (
              item.label
            )}
          </span>
          {isCheck ? (
            <span
              onClick={toggleCheck}
              className="cursor-pointer select-none text-xs font-semibold px-2.5 py-1 rounded-full"
              style={done
                ? { background: "var(--color-accent-muted)", color: "var(--color-accent)" }
                : { background: "var(--color-navy-600)", color: "var(--color-text-tertiary)" }}
              title="Tap to toggle"
            >
              {done ? "done ✓" : "not done"}
            </span>
          ) : (
            item.isBadge && done && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}>
                ✓ 100%
              </span>
            )
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isCheck ? (
            <CheckCircle pct={done ? 100 : 0} done={done} onTap={toggleCheck} onOpenMenu={editable ? () => setMenu(true) : undefined} />
          ) : (
            <span onClick={() => onIncrement && onIncrement()} className="cursor-pointer">
              <CheckCircle pct={pct} done={done} onTap={() => onIncrement && onIncrement()} onOpenMenu={editable ? () => setMenu(true) : undefined} />
            </span>
          )}
          {!isCheck && (
            <span className="text-muted mono text-[11px]">
              <EditableNumber value={item.current} onChange={onUpdate} ariaLabel="Edit result value" />
              {item.unit} /{" "}
              {editable ? (
                <>
                  <EditableNumber value={item.target} onChange={(v) => onFieldChange("target", v)} ariaLabel="Edit result target" />
                  <EditableText value={item.unit || ""} onChange={(v) => onFieldChange("unit", v)} ariaLabel="Edit result unit" />
                </>
              ) : (
                <>{item.target}{item.unit}</>
              )}
            </span>
          )}
          {!isCheck && <span className="text-heading font-semibold mono w-8 text-right">{pct}%</span>}
          {menu && (
            <ResultMenu
              item={item}
              onFieldChange={onFieldChange}
              done={done}
              onMarkDone={markDone}
              onReset={reset}
              bump={bump}
              isCheck={isCheck}
              onToggleType={() => {
                onFieldChange("resultType", isCheck ? "count" : "check");
                setMenu(false);
              }}
            />
          )}
        </div>
      </div>
      {!isCheck && (
        <div className="pr-6">
          <DragBar
            value={pct}
            color={color}
            label={`${item.label} ${pct} percent`}
            onChangeFraction={(f) => onUpdate(Math.max(0, Math.round(f * item.target)))}
          />
        </div>
      )}
    </ConfirmableRow>
  );
}

function ResultMenu({ item, onFieldChange, done, onMarkDone, onReset, bump, isCheck, onToggleType }) {
  return (
    <span
      className="absolute z-20 right-6 top-9 flex flex-col gap-1 rounded-lg px-2 py-2 text-[11px]"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-active)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onToggleType} className="stepper-opt" style={{ color: "var(--color-accent)" }}>
        {isCheck ? "☑ Switch to Count" : "☑ Switch to Checkbox"}
      </button>
      {isCheck ? (
        <>
          {!done && (
            <button onClick={onMarkDone} className="stepper-opt" style={{ color: "var(--color-success)" }}>✓ Mark done</button>
          )}
          <button onClick={onReset} className="stepper-opt" style={{ color: "var(--color-danger)" }}>↺ Reset</button>
        </>
      ) : (
        <>
          {bump && (
            <span className="flex items-center gap-1 text-muted">
              <button onClick={() => bump(-(item.incrementBy ?? 1))} className="stepper-btn">−</button>
              <span className="mono text-heading w-10 text-center">{item.current}</span>
              <button onClick={() => bump(item.incrementBy ?? 1)} className="stepper-btn">+</button>
            </span>
          )}
          <button onClick={onMarkDone} className="stepper-opt" style={{ color: "var(--color-success)" }}>✓ Mark all done</button>
          <button onClick={onReset} className="stepper-opt" style={{ color: "var(--color-danger)" }}>↺ Reset to 0</button>
          <span className="my-0.5" style={{ borderTop: "1px solid var(--color-border-subtle)" }} />
          <span className="flex items-center justify-between gap-2 px-1">
            <span className="text-text-tertiary">Step</span>
            <select
              value={item.incrementBy ?? 1}
              onChange={(e) => onFieldChange("incrementBy", parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="bg-sunken text-heading text-[11px] rounded-md px-1 py-0.5 outline-none"
              style={{ border: "1px solid var(--color-border-subtle)" }}
            >
              {PRECISIONS.map((p) => (
                <option key={p} value={p} style={{ background: "var(--color-elevated)" }}>{p}</option>
              ))}
            </select>
          </span>
        </>
      )}
    </span>
  );
}

function EmptyList({ type, onAdd, addOpen, setAddOpen, canAdd }) {
  if (!canAdd) {
    return (
      <div className="text-center py-3 border border-dashed rounded-lg mb-1" style={{ borderColor: "var(--color-border-subtle)" }}>
        <p className="text-text-tertiary text-xs mb-1">No {type} yet.</p>
      </div>
    );
  }
  return (
    <>
      {!addOpen ? (
        <div className="text-center py-3 border border-dashed rounded-lg mb-1" style={{ borderColor: "var(--color-border-subtle)" }}>
          <p className="text-text-tertiary text-xs mb-1">No {type} yet. Add one to start tracking.</p>
          <button onClick={() => setAddOpen(true)} className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
            + Add {type.replace(/s$/, "")}
          </button>
        </div>
      ) : (
        <AddForm type={type} onAdd={onAdd} onCancel={() => setAddOpen(false)} />
      )}
    </>
  );
}

function AddForm({ type, onAdd, onCancel }) {
  if (type === "actions") {
    return (
      <InlineAdd
        label="Add action"
        onCancel={onCancel}
        fields={[
          { key: "label", placeholder: "Action name" },
          {
            key: "actionType", type: "select", init: "count", value: "count",
            options: [
              { value: "count", label: "Count (tracked number)" },
              { value: "amount", label: "Amount (with unit)" },
              { value: "check", label: "Checkbox (yes/no)" },
            ],
          },
          { key: "weight", placeholder: "Weight % (0-100)", parse: (v) => parseInt(v, 10) },
          { key: "target", placeholder: "Target", parse: (v) => parseFloat(v) },
          {
            key: "unit", type: "select", placeholder: "Unit", customOption: true,
            options: [
              { value: "reps", label: "Reps" },
              { value: "sets", label: "Sets" },
              { value: "minutes", label: "Minutes" },
              { value: "hours", label: "Hours" },
              { value: "pages", label: "Pages" },
              { value: "km", label: "km" },
              { value: "miles", label: "Miles" },
              { value: "$", label: "$" },
              { value: "%", label: "%" },
            ],
          },
          {
            key: "resetType", type: "select", value: "monthly", init: "monthly",
            options: [
              { value: "none", label: "Never resets" },
              { value: "daily", label: "Resets daily" },
              { value: "weekly", label: "Resets weekly" },
              { value: "monthly", label: "Resets monthly" },
              { value: "yearly", label: "Resets yearly" },
            ],
          },
        ]}
        onSubmit={(d) => {
          const isCheck = d.actionType === "check";
          onAdd({
            label: d.label,
            weight: d.weight,
            target: isCheck ? 1 : d.target,
            unit: isCheck ? "" : d.unit,
            actionType: d.actionType || "count",
          });
        }}
      />
    );
  }
  if (type === "results") {
    return (
      <InlineAdd
        label="Add result"
        onCancel={onCancel}
        fields={[
          { key: "label", placeholder: "Result name" },
          { key: "target", placeholder: "Target", parse: (v) => parseFloat(v) },
          {
            key: "unit", type: "select", placeholder: "Unit", customOption: true,
            options: [
              { value: "reps", label: "Reps" },
              { value: "sets", label: "Sets" },
              { value: "minutes", label: "Minutes" },
              { value: "hours", label: "Hours" },
              { value: "pages", label: "Pages" },
              { value: "km", label: "km" },
              { value: "miles", label: "Miles" },
              { value: "$", label: "$" },
              { value: "%", label: "%" },
            ],
          },
          {
            key: "resultType", type: "select", init: "count", value: "count",
            options: [
              { value: "count", label: "Count (tracked number)" },
              { value: "check", label: "Checkbox (yes/no)" },
            ],
          },
        ]}
        onSubmit={(d) => onAdd({ label: d.label, target: d.target, unit: d.unit, resultType: d.resultType || "count", incrementBy: 1 })}
      />
    );
  }
  return null;
}

const PERIOD_GROUPS = [
  { key: "daily", title: "Daily Rewards" },
  { key: "weekly", title: "Weekly Rewards" },
  { key: "monthly", title: "Monthly Rewards" },
];

function rewardCostLabel(r) {
  if (r.thresholdType === "daily") return "When all today's daily tasks are done";
  if (r.thresholdType === "weekly") return "When all this week's tasks are done";
  if (r.thresholdType === "revenue") return typeof r.cost === "number" ? `$${r.cost}` : r.cost;
  if (r.thresholdType === "score") return `When score reaches ${r.cost}%`;
  if (r.thresholdType === "action" || r.thresholdType === "result") {
    const pct = r.linkedPercent ?? 100;
    const id = r.linkedActionId || r.linkedResultId;
    const allCats = useGoalsStore.getState().categories || [];
    let catName = "";
    let item = null;
    for (const c of allCats) {
      const found = (r.linkedActionId ? c.actions || [] : c.results || []).find((x) => x.id === id);
      if (found) { item = found; catName = c.isRewards ? "" : c.name; break; }
    }
    if (!item) return `When the linked task reaches ${pct}%`;
    const label = item.label || item.name || "task";
    const prefix = catName ? `${catName} – ${label}` : label;
    if (isMoneyItem(item) && item.target) {
      const amount = Math.round((pct / 100) * item.target);
      return `When ${prefix} reaches $${amount}/${Math.round(item.target)}`;
    }
    return `When ${prefix} reaches ${pct}%`;
  }
  return typeof r.cost === "number" ? `$${r.cost}` : r.cost;
}

function isMoneyItem(it) {
  const u = String(it?.unit || "").toLowerCase();
  const label = String(it?.label || "").toLowerCase();
  return u === "$" || u.includes("dollar") || /[$]|\bmoney\b|\bsaving\b|\bincome\b|\bearning\b/.test(label);
}

function findCategoryOfLinked(categories, reward) {
  if (!reward?.linkedActionId && !reward?.linkedResultId) return null;
  const id = reward.linkedActionId || reward.linkedResultId;
  return (categories || []).find((c) =>
    (c.actions || []).some((a) => a.id === id) || (c.results || []).some((r) => r.id === id)
  ) || null;
}

function RewardEditForm({ category, initial, onSubmit, onCancel }) {
  const allCategories = useGoalsStore((s) => s.categories);
  const [name, setName] = useState(initial?.name || "");
  const [linkType, setLinkType] = useState(
    initial?.thresholdType === "action" ? "action"
      : initial?.thresholdType === "result" ? "result" : "none"
  );
  const linkedCat = findCategoryOfLinked(allCategories, initial);
  const [linkCategoryId, setLinkCategoryId] = useState(linkedCat?.id || category?.id || allCategories?.[0]?.id || "");
  const [linkId, setLinkId] = useState(initial?.linkedActionId || initial?.linkedResultId || "");
  const [pct, setPct] = useState(String(initial?.linkedPercent ?? 100));
  const [period, setPeriod] = useState(initial?.period || "monthly");
  const [scoreCost, setScoreCost] = useState(String(initial?.cost ?? 80));
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : "");

  const linkCategory = allCategories.find((c) => c.id === linkCategoryId) || category;
  const items = (linkType === "action" ? linkCategory?.actions : linkCategory?.results) || [];
  const selected = items.find((it) => it.id === linkId);
  const money = linkType !== "none" && isMoneyItem(selected);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const linkedActionId = linkType === "action" && linkId ? linkId : null;
    const linkedResultId = linkType === "result" && linkId ? linkId : null;
    const thresholdType = linkType === "action" ? "action" : linkType === "result" ? "result" : (initial?.thresholdType || "score");
    const isScore = linkType === "none" && (initial?.thresholdType == null || initial?.thresholdType === "score");
    const cost = isScore
      ? Math.max(0, Math.min(100, parseFloat(scoreCost) || 0))
      : initial?.cost ?? 0;
    onSubmit({
      name: name.trim(),
      period,
      thresholdType,
      ...(isScore ? { cost, threshold: cost } : {}),
      price: price === "" ? null : Math.max(0, parseFloat(price) || 0),
      linkedActionId,
      linkedResultId,
      linkedPercent: linkType === "none" ? null : Math.max(0, Math.min(100, parseFloat(pct) || 0)),
    });
  };

  const onPickCategory = (id) => {
    setLinkCategoryId(id);
    setLinkId("");
    setPct("100");
  };

  return (
    <form onSubmit={submit} className="slide-down flex flex-col gap-2 mb-3 rounded-lg p-3"
      style={{ background: "var(--color-sunken)", border: "1px solid var(--color-border-subtle)" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Reward name"
        className="w-full bg-elevated text-heading text-sm rounded-lg px-3 py-2 outline-none"
        style={{ border: "1px solid var(--color-border-subtle)" }}
      />
      <div className="flex items-center gap-1">
        <span className="text-text-tertiary text-xs">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price it costs you (e.g. 25)"
          className="flex-1 bg-elevated text-heading text-sm rounded-lg px-3 py-2 outline-none"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-text-tertiary">Unlock when</label>
        <select
          value={linkType}
          onChange={(e) => { setLinkType(e.target.value); setLinkId(""); setPct("100"); }}
          className="bg-elevated text-heading text-xs rounded-lg px-2 py-1.5 outline-none"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          <option value="none" style={{ background: "var(--color-elevated)" }}>Score reaches</option>
          <option value="action" style={{ background: "var(--color-elevated)" }}>A task reaches</option>
          <option value="result" style={{ background: "var(--color-elevated)" }}>A result reaches</option>
        </select>
        {linkType === "none" ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              value={scoreCost}
              onChange={(e) => setScoreCost(e.target.value)}
              className="w-14 bg-elevated text-heading text-xs rounded-lg px-2 py-1.5 outline-none text-right"
              style={{ border: "1px solid var(--color-border-subtle)" }}
            />
            <span className="text-text-tertiary">%</span>
          </div>
        ) : (
          <>
            <select
              value={linkCategoryId}
              onChange={(e) => onPickCategory(e.target.value)}
              className="bg-elevated text-heading text-xs rounded-lg px-2 py-1.5 outline-none max-w-[150px]"
              style={{ border: "1px solid var(--color-border-subtle)" }}
              aria-label="Category"
            >
              {(allCategories || []).map((c) => (
                <option key={c.id} value={c.id} style={{ background: "var(--color-elevated)" }}>{c.name}</option>
              ))}
            </select>
            <select
              value={linkId}
              onChange={(e) => { setLinkId(e.target.value); setPct("100"); }}
              className="bg-elevated text-heading text-xs rounded-lg px-2 py-1.5 outline-none max-w-[150px]"
              style={{ border: "1px solid var(--color-border-subtle)" }}
              aria-label={linkType === "action" ? "Task" : "Result"}
            >
              <option value="" disabled style={{ background: "var(--color-elevated)" }}>
                {linkType === "action" ? "Choose task…" : "Choose result…"}
              </option>
              {items.map((it) => (
                <option key={it.id} value={it.id} style={{ background: "var(--color-elevated)" }}>
                  {it.label || it.name}{it.unit ? ` (${it.unit})` : ""}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              {money ? (
                <>
                  <span className="text-text-tertiary">$</span>
                  <input
                    type="number"
                    min="0"
                    value={selected?.target ? String(Math.round(((parseFloat(pct) || 0) / 100) * selected.target)) : "0"}
                    onChange={(e) => {
                      const amt = Math.max(0, parseFloat(e.target.value) || 0);
                      const target = selected?.target;
                      setPct(target ? String(Math.min(100, (amt / target) * 100)) : "0");
                    }}
                    className="w-16 bg-elevated text-heading text-xs rounded-lg px-2 py-1.5 outline-none text-right"
                    style={{ border: "1px solid var(--color-border-subtle)" }}
                  />
                  <span className="text-text-tertiary">/ ${Math.round(selected?.target || 0)}</span>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={pct}
                    onChange={(e) => setPct(e.target.value)}
                    className="w-14 bg-elevated text-heading text-xs rounded-lg px-2 py-1.5 outline-none text-right"
                    style={{ border: "1px solid var(--color-border-subtle)" }}
                  />
                  <span className="text-text-tertiary">%</span>
                </>
              )}
            </div>
          </>
        )}
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-elevated text-heading text-xs rounded-lg px-2 py-1.5 outline-none"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          <option value="daily" style={{ background: "var(--color-elevated)" }}>Daily</option>
          <option value="weekly" style={{ background: "var(--color-elevated)" }}>Weekly</option>
          <option value="monthly" style={{ background: "var(--color-elevated)" }}>Monthly</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg text-muted">Cancel</button>
        <button type="submit" className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: ACCENT, color: "#000" }}>
          {initial ? "Save" : "Add reward"}
        </button>
      </div>
    </form>
  );
}

function RewardsGrid({ category, rewards, onClaim, onUnclaim, onAddReward, onUpdateReward, onDeleteReward }) {
  const allCategories = useGoalsStore((s) => s.categories);
  const qualityPercent = useGoalsStore((s) => s.dashboard?.stats?.qualityPercent ?? Math.round(computeOverallPct(allCategories)));
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const groups = PERIOD_GROUPS.map((g) => ({
    ...g,
    items: (rewards || []).filter((r) => (r.period || "monthly") === g.key),
  }));

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.key}>
          <h4 className="caption text-text-tertiary font-bold uppercase tracking-wide text-[11px] mb-2">
            {g.title}
          </h4>
          {g.items.length === 0 && !adding ? (
            <div className="text-xs text-text-tertiary">
              No {g.title} set yet
              <button onClick={() => setAdding(true)} className="ml-2 font-semibold" style={{ color: "var(--color-accent)" }}>
                + Add
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {g.items.map((r) => {
                const unlocked = checkRewardUnlock(r, { categories: allCategories, stats: { qualityPercent } });
                const editing = editingId === r.id;
                return (
                  <div
                    key={r.id}
                    className="rounded-[10px] p-3.5 border flex flex-col justify-between gap-2 min-h-[96px] relative"
                    style={{
                      background: "var(--color-sunken)",
                      borderColor: r.claimed
                        ? "rgba(109,245,227,0.45)"
                        : unlocked
                        ? "rgba(135,255,95,0.4)"
                        : "var(--color-border-subtle)",
                      opacity: r.claimed ? 0.75 : 1,
                    }}
                  >
                    {!editing && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                        <button
                          onClick={() => { setAdding(false); setEditingId(r.id); }}
                          aria-label="Edit reward"
                          title="Edit reward"
                          className="p-0.5 cursor-pointer text-text-tertiary hover:text-heading transition-colors"
                        >
                          <PencilIcon show={false} />
                        </button>
                        <button
                          onClick={() => onDeleteReward(category.id, r.id)}
                          aria-label="Delete reward"
                          title="Remove reward"
                          className="p-0.5 cursor-pointer text-danger opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <XIcon />
                        </button>
                      </div>
                    )}
                    {editing ? (
                      <RewardEditForm
                        category={category}
                        initial={r}
                        onSubmit={(data) => { onUpdateReward(category.id, r.id, data); setEditingId(null); }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <div className="text-heading text-sm font-bold leading-tight">{r.name}</div>
                            </div>
                            <div className="text-muted text-xs mt-0.5">{rewardCostLabel(r)}</div>
                          </div>
                          {r.claimed && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "rgba(109,245,227,0.15)", color: "var(--color-accent)" }}>
                              Claimed
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {r.price != null && (
                              <span className="text-[11px] font-bold shrink-0 rounded-full px-2 py-0.5" style={{ background: "rgba(255,161,77,0.15)", color: "#FFA14D" }}>
                                ${Math.round(r.price)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          {r.claimed && (
                            <button
                              onClick={() => onUnclaim(r.id)}
                              title="Redo / unclaim this reward"
                              className="btn-lift text-[10px] font-semibold px-2 py-1 rounded-full"
                              style={{ background: "var(--color-sunken)", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border-subtle)" }}
                            >
                              ↺ redo
                            </button>
                          )}
                          <button
                            disabled={!unlocked || r.claimed}
                            onClick={() => onClaim(r.id)}
                            className="btn-lift text-[11px] font-semibold px-3 py-1.5 rounded-full"
                            style={
                              r.claimed
                                ? { background: "rgba(135,255,95,0.15)", color: "var(--color-success)", border: "1px solid rgba(135,255,95,0.3)", cursor: "default" }
                                : unlocked
                                ? { background: "rgba(109,245,227,0.15)", color: "var(--color-accent)", border: "1px solid rgba(109,245,227,0.3)" }
                                : { background: "rgba(219,96,136,0.15)", color: "var(--color-danger)", border: "1px solid rgba(219,96,136,0.3)", opacity: 0.7 }
                            }
                          >
                            {r.claimed ? "Claimed" : unlocked ? "Claim" : "Locked"}
                          </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {adding && (
                <RewardEditForm
                  category={category}
                  initial={null}
                  onSubmit={(data) => { onAddReward(category.id, data); setAdding(false); }}
                  onCancel={() => setAdding(false)}
                />
              )}
            </div>
          )}
        </div>
      ))}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 text-xs font-semibold self-start"
          style={{ color: "var(--color-accent)" }}
        >
          + Add reward
        </button>
      )}
    </div>
  );
}

export default memo(function CategoryCard({
  category, index, onMove,
  onActionUpdate, onActionIncrement, onResultUpdate, onResultIncrement,
  onToggle, onAddAction, onDeleteAction, onAddResult, onDeleteResult,
  onUpdateCategory, onDeleteCategory, onClaimReward, onUnclaimReward,
  onAddReward, onUpdateReward, onDeleteReward,
}) {
  const editMode = useGoalsStore((s) => s.editMode);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(false);
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [colorOpen, setColorOpen] = useState(false);
  const [addOpen, setAddOpen] = useState({ actions: false, results: false });
  const catTimer = useRef(null);

  const onDragStart = (e) => {
    if (!editMode) { e.preventDefault(); return; }
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("dragging");
  };

  const onDragOver = (e) => {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(from) && from !== index && onMove) onMove(from, index);
    e.currentTarget.classList.remove("dragging");
  };

  const onDragEnd = (e) => e.currentTarget.classList.remove("dragging");

  const open = category.expanded !== false;
  // Card accent: dotColor drives the border-left line + name/% text color.
  const headerColor = dotColorToHex(category.dotColor);
  const pct = Math.round(categoryPct(category));
  const weightsSum = category.isRewards ? 100 : categoryWeightsSum(category);
  const weightsOff = !category.isRewards && (category.actions || []).length > 0 && weightsSum !== 100;

  const commitName = () => {
    setEditName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== category.name) onUpdateCategory(category.id, { name: trimmed });
    else setNameDraft(category.name);
  };

  const requestDeleteCat = () => {
    setConfirmDeleteCat(true);
    catTimer.current = setTimeout(() => setConfirmDeleteCat(false), 5000);
  };

  useEffect(() => () => clearTimeout(catTimer.current), []);

  return (
    <section
      className="card card-lift overflow-hidden"
      draggable={editMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
      borderLeftColor: headerColor,
      borderLeftWidth: '4px',
      borderLeftStyle: 'solid',
      cursor: editMode ? "grab" : undefined,
    }}>
      <div className="w-full flex items-center justify-between px-4 py-3.5" style={{
        backgroundColor: headerColor === "#ffffff" || headerColor === CATEGORY_COLORS.turquoise.hex ? "var(--color-sunken)" : "var(--color-elevated)"
      }}>
        {editMode && (
          <span className="drag-handle shrink-0 cursor-grab text-text-tertiary select-none" title="Drag to reorder" style={{ marginRight: 4 }}>⠿</span>
        )}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: headerColor }} />
          {editName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setEditName(false); setNameDraft(category.name); }
              }}
              className="bg-sunken text-heading text-sm font-semibold rounded px-2 py-0.5 outline-none"
              aria-label="Edit category name"
            />
          ) : (
            <span className="text-heading font-semibold text-sm truncate">{category.name}</span>
          )}
          {!editName && editMode ? (
            <button onClick={() => { setNameDraft(category.name); setEditName(true); }} aria-label="Edit category name" className="cursor-pointer pencil-hover-parent">
              <PencilIcon show={false} />
            </button>
          ) : null}
          {editMode && (
            <span className="relative inline-flex items-center">
              <button
                onClick={() => setColorOpen((o) => !o)}
                aria-label="Change category color"
                title="Change color"
                className="w-3.5 h-3.5 rounded-full shrink-0 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                style={{ background: headerColor, border: "1px solid var(--color-border-active)" }}
              />
              {colorOpen && (
                <span
                  className="absolute left-0 top-4 z-30 flex gap-1.5 rounded-lg px-2 py-1.5"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-active)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {Object.entries(CATEGORY_COLORS).map(([key, c]) => (
                    <button
                      key={key}
                      onClick={() => { onUpdateCategory(category.id, { dotColor: key }); setColorOpen(false); }}
                      aria-label={c.label}
                      title={c.label}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: c.hex,
                        border: category.dotColor === key ? "2px solid var(--color-text-heading)" : "1px solid var(--color-border-active)",
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </span>
              )}
            </span>
          )}
          {editMode && (
            <button
              onClick={() => onUpdateCategory(category.id, { fullWidth: !category.fullWidth })}
              title={category.fullWidth ? "Switch to half width" : "Switch to full width"}
              className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-opacity"
              style={{
                background: category.fullWidth ? "rgba(109,245,227,0.2)" : "var(--color-navy-600)",
                color: category.fullWidth ? "var(--color-accent)" : "var(--color-text-tertiary)",
                border: "1px solid " + (category.fullWidth ? "rgba(109,245,227,0.3)" : "var(--color-border-subtle)")
              }}
            >
              {category.fullWidth ? "↔ Full" : "↔ Half"}
            </button>
          )}
          {weightsOff ? (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
              style={{ background: "rgba(230,187,133,0.15)", color: "var(--color-warning)" }}
              title="Action weights do not sum to 100%"
            >
              Weights: {weightsSum}%
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {editMode && !confirmDeleteCat ? (
            <button onClick={requestDeleteCat} aria-label="Delete category" title="Remove category" className="cursor-pointer p-1 text-danger opacity-60 hover:opacity-100 transition-opacity">
              <XIcon />
            </button>
          ) : editMode && confirmDeleteCat ? (
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--color-danger)" }}>
              Delete?
              <button onClick={() => { clearTimeout(catTimer.current); setConfirmDeleteCat(false); onDeleteCategory(category.id); }}
                className="px-1.5 py-0.5 rounded text-white text-[10px] font-semibold" style={{ background: "var(--color-danger)" }}>
                Yes
              </button>
              <button onClick={() => setConfirmDeleteCat(false)} className="text-muted px-1">✕</button>
            </span>
          ) : null}

          {category.isRewards ? (
            <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              {category.rewards?.every((r) => r.claimed) ? "Unlocked 🎉" : "Locked 🔒"}
            </span>
          ) : (
            <span className="font-bold text-base mono" style={{ color: headerColor }}>{pct}%</span>
          )}

          <button onClick={() => onToggle(category.id)} aria-expanded={open} aria-label="Toggle category" className="cursor-pointer" style={{ color: headerColor }}>
            <Chevron open={open} />
          </button>
        </div>
      </div>

      {open ? (
        <div className="accordion-body px-4 pb-4 pt-0" style={{ 
          backgroundColor: headerColor === "#ffffff" || headerColor === CATEGORY_COLORS.turquoise.hex ? "var(--color-sunken)" : "var(--color-elevated)"
        }}>
          {category.isRewards ? (
            category.rewards.length ? (
              <RewardsGrid rewards={category.rewards} category={category} onClaim={onClaimReward} onUnclaim={onUnclaimReward} onAddReward={onAddReward} onUpdateReward={onUpdateReward} onDeleteReward={onDeleteReward} />
            ) : (
              <RewardsGrid rewards={category.rewards} category={category} onClaim={onClaimReward} onUnclaim={onUnclaimReward} onAddReward={onAddReward} onUpdateReward={onUpdateReward} onDeleteReward={onDeleteReward} />
            )
          ) : (
            <>
              <div className="mb-4">
                <h3 className="caption text-text-tertiary font-semibold mb-2" style={{ color: headerColor }}>
                  Actions · Scored
                </h3>
                {(category.actions || []).length === 0 ? (
                  <EmptyList type="actions" canAdd={editMode} onAdd={(d) => onAddAction(category.id, d)} addOpen={addOpen.actions} setAddOpen={(v) => setAddOpen((s) => ({ ...s, actions: v }))} />
                ) : (
                  <>
                    <div className="flex flex-col gap-0.5">
                      {(category.actions || []).map((item, i) => (
                        <ActionRow key={item.id || item.label} item={item} color={headerColor} editable={editMode}
                          onUpdate={(v) => onActionUpdate(category.id, i, "current", v)}
                          onFieldChange={(field, value) => onActionUpdate(category.id, i, field, value)}
                          onIncrement={(amt) => onActionIncrement(category.id, i, amt)}
                          onDelete={() => onDeleteAction(category.id, i)} />
                      ))}
                    </div>
                    {editMode && (addOpen.actions ? (
                      <AddForm type="actions" onAdd={(d) => onAddAction(category.id, d)} onCancel={() => setAddOpen((s) => ({ ...s, actions: false }))} />
                    ) : (
                      <button onClick={() => setAddOpen((s) => ({ ...s, actions: true }))} className="mt-1 text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
                        + Add action
                      </button>
                    ))}
                  </>
                )}
              </div>

              <div>
                <h3 className="caption text-text-tertiary font-semibold mb-2" style={{ color: headerColor }}>
                  Results · Tracked
                </h3>
                {(category.results || []).length === 0 ? (
                  <EmptyList type="results" canAdd={editMode} onAdd={(d) => onAddResult(category.id, d)} addOpen={addOpen.results} setAddOpen={(v) => setAddOpen((s) => ({ ...s, results: v }))} />
                ) : (
                  <>
                    <div className="flex flex-col gap-0.5">
                      {(category.results || []).map((item, i) => (
                        <ResultRow key={item.id || item.label} item={item} color={headerColor} editable={editMode}
                          onUpdate={(v) => onResultUpdate(category.id, i, "current", v)}
                          onFieldChange={(field, value) => onResultUpdate(category.id, i, field, value)}
                          onIncrement={(amt) => onResultIncrement && onResultIncrement(category.id, i, amt)}
                          onDelete={() => onDeleteResult(category.id, i)} />
                      ))}
                    </div>
                    {editMode && (addOpen.results ? (
                      <AddForm type="results" onAdd={(d) => onAddResult(category.id, d)} onCancel={() => setAddOpen((s) => ({ ...s, results: false }))} />
                    ) : (
                      <button onClick={() => setAddOpen((s) => ({ ...s, results: true }))} className="mt-1 text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
                        + Add result
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
});
