import { useEffect, useMemo, useRef, useState } from "react";
import { usePlanStore } from "../store/usePlanStore";

const HOUR_START = 0;   // first visible hour (full day)
const HOUR_END = 24;    // last visible hour
const HOUR_PX = 60;     // grid height per hour (px)
const GRID_START_MIN = HOUR_START * 60;
const GRID_END_MIN = HOUR_END * 60;
const GRID_TOTAL_MIN = GRID_END_MIN - GRID_START_MIN;
const SNAP_MIN = 5; // fine-grained moves so times aren't locked to quarter hours

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const REPEATS = [
  { value: "today", label: "Today only" },
  { value: "thisweek", label: "This week" },
  { value: "daily", label: "Every day" },
  { value: "monthly", label: "Every month" },
];

const TYPE_COLORS = { action: "#6DF5E3", result: "#A4D2EC" };

const pad2 = (n) => String(n).padStart(2, "0");
const hms = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseDay = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

const mondayOf = (d) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = c.getDay() === 0 ? 7 : c.getDay();
  return addDays(c, 1 - dow);
};

const toMin = (t) => {
  const [h, m] = String(t || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const snap = (min, step = SNAP_MIN) => Math.round(min / step) * step;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Grid runs bottom = midnight (00:00) up to top = 23:00.
const topPct = (min) => 100 - ((min - GRID_START_MIN) / GRID_TOTAL_MIN) * 100;

// "00:00" at the bottom, then 12h am/pm labels flowing upward.
const hourLabel = (h) => {
  if (h === 0 || h % 24 === 0) return "00:00";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad2(h12)}:00 ${h < 12 ? "am" : "pm"}`;
};

// Day keys in [winStart, winEnd] that a recurring row covers.
function repeatInstances(row, winStart, winEnd) {
  const w0 = winStart.getTime();
  const w1 = winEnd.getTime();
  const out = [];
  const rowDay = parseDay(row.date);
  const rowT = rowDay.getTime();

  if (row.repeat === "thisweek") {
    const ws = mondayOf(rowDay);
    for (let i = 0; i < 7; i++) {
      const t = addDays(ws, i).getTime();
      if (t >= w0 && t <= w1) out.push(dayKey(addDays(ws, i)));
    }
    return out;
  }

  if (row.repeat === "daily") {
    for (let d = new Date(rowDay); d.getTime() <= w1; d = addDays(d, 1)) {
      const t = d.getTime();
      if (t >= w0) out.push(dayKey(d));
    }
    return out;
  }

  if (row.repeat === "monthly") {
    let y = rowDay.getFullYear();
    let mo = rowDay.getMonth();
    for (let it = 0; it < 1200; it++) {
      const dom = Math.min(rowDay.getDate(), new Date(y, mo + 1, 0).getDate());
      const d = new Date(y, mo, dom);
      const t = d.getTime();
      if (t > w1) break;
      if (t >= w0) out.push(dayKey(d));
      mo += 1;
      if (mo > 11) {
        mo = 0;
        y += 1;
      }
    }
    return out;
  }

  // today (default): only on the row's own date
  if (rowT >= w0 && rowT <= w1) out.push(row.date);
  return out;
}

function taskOptions(categories) {
  const opts = [];
  for (const cat of categories || []) {
    for (let i = 0; i < (cat.actions || []).length; i++) {
      const a = cat.actions[i];
      if (a._deleted) continue;
      opts.push({
        key: `${cat.id}::action::${i}`,
        catId: cat.id,
        type: "action",
        idx: i,
        label: a.label,
        catName: cat.name || cat.label || "Category",
      });
    }
    for (let i = 0; i < (cat.results || []).length; i++) {
      const r = cat.results[i];
      if (r._deleted) continue;
      opts.push({
        key: `${cat.id}::result::${i}`,
        catId: cat.id,
        type: "result",
        idx: i,
        label: r.label,
        catName: cat.name || cat.label || "Category",
      });
    }
  }
  return opts;
}

export default function PlanPage({ categories, onBack }) {
  const schedule = usePlanStore((s) => s.schedule);
  const addSlot = usePlanStore((s) => s.addSlot);
  const updateSlot = usePlanStore((s) => s.updateSlot);
  const removeSlot = usePlanStore((s) => s.removeSlot);

  const [mode, setMode] = useState("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ taskKey: "", date: dayKey(new Date()), start: "09:00", end: "10:00", repeat: "today" });
  const [err, setErr] = useState("");

  const dragState = useRef(null);
  const [draft, setDraft] = useState(null);

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const options = useMemo(() => taskOptions(categories), [categories]);

  const rows = useMemo(
    () =>
      schedule.map((r) => {
        const cat = (categories || []).find((c) => c.id === r.catId);
        const list = cat ? cat[r.type + "s"] || [] : [];
        const task = list[r.idx];
        if (!task || task._deleted) return null;
        return { ...r, label: task.label || r.label, catName: cat.name || r.catName };
      }),
    [schedule, categories]
  ).filter(Boolean);

  // View window for the current mode (used to expand recurrences).
  const win = useMemo(() => {
    if (mode === "week") {
      const ws = mondayOf(anchor);
      return { start: ws, end: addDays(ws, 6) };
    }
    if (mode === "month") {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      return { start, end };
    }
    return { start: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()), end: anchor };
  }, [mode, anchor]);

  const instances = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      for (const dk of repeatInstances(r, win.start, win.end)) {
        if (!m.has(dk)) m.set(dk, []);
        m.get(dk).push(r);
      }
    }
    return m;
  }, [rows, win]);

  const submit = () => {
    if (!form.taskKey) return setErr("Pick a task first.");
    const a = toMin(form.start);
    const b = toMin(form.end);
    if (b <= a) return setErr("End time must be after start time.");
    const opt = options.find((o) => o.key === form.taskKey);
    if (!opt) return setErr("That task no longer exists.");

    const payload = {
      catId: opt.catId,
      type: opt.type,
      idx: opt.idx,
      label: opt.label,
      catName: opt.catName,
      date: form.date,
      start: form.start || "09:00",
      end: form.end || "10:00",
      repeat: form.repeat || "today",
    };
    if (editingId) updateSlot(editingId, payload);
    else addSlot(payload);
    setErr("");
    setFormOpen(false);
    setEditingId(null);
  };

  const openFormFor = (date) => {
    const now = new Date();
    const startH = clamp(now.getHours(), HOUR_START, HOUR_END - 2);
    setForm({ ...form, taskKey: "", date, repeat: "today", start: `${pad2(startH)}:00`, end: `${pad2(startH + 1)}:00` });
    setEditingId(null);
    setFormOpen(true);
  };

  const openEditFor = (row) => {
    setForm({
      taskKey: `${row.catId}::${row.type}::${row.idx}`,
      date: row.date,
      start: row.start,
      end: row.end,
      repeat: row.repeat || "today",
    });
    setEditingId(row.id);
    setFormOpen(true);
  };

  // ── Drag + resize ────────────────────────────────────
  const gridMinFromClientY = (gridEl, clientY) => {
    const rect = gridEl.getBoundingClientRect();
    return GRID_START_MIN + ((clientY - rect.top) / rect.height) * GRID_TOTAL_MIN;
  };

  const blockPos = (row, overrideMin) => {
    const a = overrideMin ? overrideMin.start : toMin(row.start);
    const b = (overrideMin ? overrideMin.end : toMin(row.end)) || a + 15;
    // Flipped grid: the visual top edge of a block is its later (end) time.
    const top = topPct(b);
    // Box height == exactly the duration set; a tiny floor only keeps sub-5-min blocks grabbable.
    const height = Math.max(((b - a) / GRID_TOTAL_MIN) * 100, 0.35);
    return { top: `${top}%`, height: `${height}%` };
  };

  const onBlockPointerDown = (e, gridEl, row) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    const rect = gridEl.getBoundingClientRect();
    const yInRect = e.clientY - rect.top;
    const zone = Math.min(8, Math.max(5, rect.height * 0.12));
    let mode = "move";
    if (yInRect < zone) mode = "resizeStart"; // top edge = start time (make it more before / later)
    else if (yInRect > rect.height - zone) mode = "resizeEnd"; // bottom edge = end time (add/remove minutes)
    dragState.current = {
      id: row.id,
      grabMin: gridMinFromClientY(gridEl, e.clientY),
      startMin: toMin(row.start),
      endMin: toMin(row.end),
      mode,
    };
    gridEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onGridPointerMove = (e, gridEl) => {
    const ds = dragState.current;
    if (!ds) return;
    const raw = gridMinFromClientY(gridEl, e.clientY);
    if (ds.mode === "resizeEnd") {
      const end = clamp(snap(raw), ds.startMin + SNAP_MIN, GRID_END_MIN);
      setDraft({ id: ds.id, start: ds.startMin, end });
    } else if (ds.mode === "resizeStart") {
      const start = clamp(snap(raw), GRID_START_MIN, ds.endMin - SNAP_MIN);
      setDraft({ id: ds.id, start, end: ds.endMin });
    } else {
      const start = clamp(snap(ds.startMin + (raw - ds.grabMin)), GRID_START_MIN, GRID_END_MIN - SNAP_MIN);
      const end = start + (ds.endMin - ds.startMin);
      setDraft({ id: ds.id, start, end });
    }
  };

  const onGridPointerUp = () => {
    const ds = dragState.current;
    dragState.current = null;
    if (ds && draft && draft.id === ds.id) {
      updateSlot(ds.id, { start: hms(draft.start), end: hms(draft.end) });
    }
    setDraft(null);
  };

  // ── Rendering helpers ───────────────────────────────
  const renderDayColumn = (date) => {
    const key = dayKey(date);
    const dayRows = instances.get(key) || [];
    return (
      <div
        style={{ ...gridStyle, position: "relative" }}
        className="relative rounded-lg overflow-hidden select-none"
      >
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => openFormFor(key)}
          title="Click to add a task"
        />
        {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
          const h = HOUR_START + i;
          const bottomP = (i / (HOUR_END - HOUR_START)) * 100;
          return (
            <div
              key={h}
              className="absolute left-0 right-0"
              style={{ top: `${100 - bottomP - 100 / (HOUR_END - HOUR_START)}%`, height: `${100 / (HOUR_END - HOUR_START)}%`, borderTop: "1px solid var(--color-border-subtle)" }}
            >
              <span className="absolute left-1.5 text-[9px] font-mono text-text-tertiary" style={{ bottom: "2px" }}>
                {hourLabel(h)}
              </span>
            </div>
          );
        })}
        {(() => {
          const isToday = key === dayKey(new Date(nowTick));
          const nd = new Date(nowTick);
          const nowMin = nd.getHours() * 60 + nd.getMinutes();
          if (!isToday || nowMin < GRID_START_MIN || nowMin > GRID_END_MIN) return null;
          return (
            <div
              className="absolute pointer-events-none"
              style={{ left: 58, right: 0, top: `${topPct(nowMin)}%` }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: 3,
                  top: -1.5,
                  borderTop: "1.5px solid rgba(219,96,136,0.9)",
                  borderBottom: "1.5px solid rgba(219,96,136,0.9)",
                  background: "rgba(219,96,136,0.14)",
                  backdropFilter: "blur(2px)",
                  WebkitBackdropFilter: "blur(2px)",
                  boxShadow: "0 0 12px rgba(219,96,136,0.4)",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  top: -8,
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: "#DB6088",
                  background: "rgba(14,24,23,0.65)",
                  backdropFilter: "blur(3px)",
                  WebkitBackdropFilter: "blur(3px)",
                  border: "1px solid #DB6088",
                  borderRadius: 5,
                  padding: "1px 5px",
                  letterSpacing: "0.05em",
                }}
              >
                NOW {hms(nowMin)}
              </span>
            </div>
          );
        })()}
        {dayRows.map((row) => {
          const override = draft && draft.id === row.id ? draft : null;
          const pos = blockPos(row, override);
          const color = TYPE_COLORS[row.type] || "var(--color-accent)";
          return (
            <div
              key={row.id + key}
              className="absolute rounded-md px-1.5 py-0.5 flex flex-col cursor-grab active:cursor-grabbing"
              style={{
                ...pos,
                left: "2%",
                width: "96%",
                background: row.type === "action" ? "rgba(109,245,227,0.16)" : "rgba(164,210,236,0.16)",
                borderLeft: `3px solid ${color}`,
                border: `1px solid ${color}44`,
                borderLeftWidth: 3,
                touchAction: "none",
              }}
              title={`${row.label} (${row.repeat || "today"}) — drag middle to move, top edge = start time, bottom edge = end`}
              onPointerDown={(e) => onBlockPointerDown(e, e.currentTarget.closest(".plan-grid"), row)}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[10px] font-semibold text-white truncate">{row.label}</span>
                <span className="shrink-0 text-[9px] mono text-white/70">{row.start}–{row.end}</span>
                <span className="ml-auto shrink-0 flex items-center gap-0.5">
                  <button
                    onClick={() => openEditFor(row)}
                    className="text-white/50 hover:text-white/90 text-[10px] leading-none px-0.5 rounded hover:bg-white/10"
                    aria-label={`Edit ${row.label}`}
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => removeSlot(row.id)}
                    className="text-white/50 hover:text-white/90 text-[10px] leading-none px-0.5 rounded hover:bg-white/10"
                    aria-label={`Remove ${row.label}`}
                  >
                    ×
                  </button>
                </span>
              </div>
              <div className="absolute bottom-0 left-1 right-1 h-[5px] cursor-ns-resize rounded-b-md opacity-60 hover:opacity-100" style={{ background: `${color}55` }} />
              <div className="absolute top-0 left-1 right-1 h-[5px] cursor-ns-resize rounded-t-md opacity-60 hover:opacity-100" style={{ background: `${color}55` }} />
            </div>
          );
        })}
      </div>
    );
  };

  const gridStyle = { height: (HOUR_END - HOUR_START) * HOUR_PX };

  const weekStart = mondayOf(anchor);
  const monthGrid = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const startDow = first.getDay() === 0 ? 7 : first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 1 - startDow; i <= daysInMonth - startDow; i++) {
      const d = addDays(first, i - 1);
      cells.push({ date: d, inMonth: d.getMonth() === m });
    }
    return cells;
  }, [anchor]);

  const nav = {
    title:
      mode === "day"
        ? `${WEEKDAYS[anchor.getDay() === 0 ? 6 : anchor.getDay() - 1]}, ${anchor.getDate()} ${MONTHS[anchor.getMonth()]}`
        : mode === "week"
        ? `Week of ${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]}`
        : `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`,
    back() {
      if (mode === "day") setAnchor(addDays(anchor, -1));
      else if (mode === "week") setAnchor(addDays(anchor, -7));
      else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
    },
    fwd() {
      if (mode === "day") setAnchor(addDays(anchor, 1));
      else if (mode === "week") setAnchor(addDays(anchor, 7));
      else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
    },
    today() {
      setAnchor(new Date());
    },
  };

  const tab = (m, label) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      className="px-3 py-1.5 text-xs font-semibold rounded-full transition-colors"
      style={{
        background: mode === m ? "var(--color-accent-muted)" : "transparent",
        color: mode === m ? "var(--color-accent)" : "var(--color-text-tertiary)",
        border: "1px solid " + (mode === m ? "var(--color-accent)" : "var(--color-border-subtle)"),
      }}
    >
      {label}
    </button>
  );

  const controlBtn = { border: "1px solid var(--color-border-active)", color: "var(--color-text-secondary)" };

  const selectCls = "bg-sunken border border-border-subtle rounded-md px-2 py-1.5 text-xs text-white";

  return (
    <div className="page-container py-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="nav-btn" style={controlBtn} title="Back to dashboard">
          ← Dashboard
        </button>
        <div className="flex items-center gap-1.5 flex-wrap">
          {tab("day", "Day")}
          {tab("week", "Week")}
          {tab("month", "Month")}
        </div>
        <button onClick={nav.today} className="nav-btn" style={controlBtn}>Today</button>
        <div className="flex items-center gap-1">
          <button onClick={nav.back} className="nav-btn" style={controlBtn} aria-label="Previous">‹</button>
          <button onClick={nav.fwd} className="nav-btn" style={controlBtn} aria-label="Next">›</button>
        </div>
        <h2 className="text-base font-bold text-white mx-1">{nav.title}</h2>
        <button
          onClick={() => {
            if (formOpen) {
              setFormOpen(false);
              setEditingId(null);
            } else openFormFor(dayKey(anchor));
          }}
          className="nav-btn nav-btn-primary ml-auto"
          style={formOpen ? { background: "var(--color-sunken)", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border-active)" } : { background: "var(--color-accent)", color: "#101010" }}
        >
          {formOpen ? "Cancel" : "+ Add task"}
        </button>
      </div>

      {formOpen && (
        <div className="card p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-white">
            {editingId ? "Edit scheduled task" : "Schedule a task"}
            {editingId && <span className="ml-2 text-[10px] font-normal text-text-tertiary">edits apply to all repetitions</span>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-[11px] text-text-tertiary sm:col-span-2">
              Task
              <select value={form.taskKey} onChange={(e) => setForm({ ...form, taskKey: e.target.value })} className={selectCls}>
                <option value="">Pick a task…</option>
                <optgroup label="Actions">
                  {options.filter((o) => o.type === "action").map((o) => (
                    <option key={o.key} value={o.key}>{o.catName} › {o.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Results">
                  {options.filter((o) => o.type === "result").map((o) => (
                    <option key={o.key} value={o.key}>{o.catName} › {o.label}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-text-tertiary">
              Date
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={selectCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-text-tertiary">
              Start
              <input type="time" step={900} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={selectCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-text-tertiary">
              End
              <input type="time" step={900} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={selectCls} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-text-tertiary">
              Repeat
              <select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })} className={selectCls}>
                {REPEATS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
          </div>
          {err && <div className="text-xs text-danger">{err}</div>}
          <div className="flex gap-2">
            <button onClick={submit} className="nav-btn nav-btn-primary" style={{ background: "var(--color-accent)", color: "#101010" }}>
              {editingId ? "Save changes" : "Add to schedule"}
            </button>
            {editingId && (
              <button
                onClick={() => { setFormOpen(false); setEditingId(null); }}
                className="nav-btn"
                style={controlBtn}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "month" ? (
        <div className="card p-4">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-text-tertiary uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthGrid.map(({ date, inMonth }) => {
              const key = dayKey(date);
              const count = (instances.get(key) || []).length;
              const isToday = key === dayKey(new Date());
              return (
                <button
                  key={key}
                  onClick={() => { setAnchor(date); setMode("day"); }}
                  className="rounded-lg min-h-[52px] flex flex-col items-center justify-start pt-1.5 transition-colors overflow-hidden"
                  style={{
                    background: inMonth ? "var(--color-sunken)" : "transparent",
                    opacity: inMonth ? 1 : 0.25,
                    border: isToday ? "1px solid var(--color-accent)" : "1px solid var(--color-border-subtle)",
                    boxShadow: isToday ? "0 0 12px rgba(109,245,227,0.25)" : undefined,
                  }}
                >
                  <span className="text-[11px] font-mono" style={{ color: inMonth ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}>
                    {date.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}>
                      {count} task{count > 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : mode === "week" ? (
        <div className="card p-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(7, minmax(0, 1fr))` }}>
            {Array.from({ length: 7 }, (_, i) => {
              const date = addDays(weekStart, i);
              const key = dayKey(date);
              const isToday = key === dayKey(new Date());
              return (
                <div key={i} className="min-w-0">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <span className="text-[10px] font-semibold uppercase" style={{ color: isToday ? "var(--color-accent)" : "var(--color-text-tertiary)" }}>
                      {WEEKDAYS[i]} <span className="font-mono">{date.getDate()}</span>
                    </span>
                    <button
                      onClick={() => openFormFor(key)}
                      className="text-[11px] leading-none text-text-tertiary hover:text-accent px-1 rounded hover:bg-white/5"
                      aria-label={`Add task on ${WEEKDAYS[i]}`}
                    >
                      +
                    </button>
                  </div>
                  <div
                    className="plan-grid"
                    onPointerMove={(e) => onGridPointerMove(e, e.currentTarget)}
                    onPointerUp={onGridPointerUp}
                    onPointerCancel={onGridPointerUp}
                  >
                    {renderDayColumn(date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-white">
              {WEEKDAYS[anchor.getDay() === 0 ? 6 : anchor.getDay() - 1]}, {anchor.getDate()} {MONTHS[anchor.getMonth()]}
            </div>
            <div className="text-[10px] text-text-tertiary hidden sm:inline">{dayKey(anchor)}</div>
          </div>
          <div
            className="plan-grid"
            onPointerMove={(e) => onGridPointerMove(e, e.currentTarget)}
            onPointerUp={onGridPointerUp}
            onPointerCancel={onGridPointerUp}
          >
            {renderDayColumn(anchor)}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-tertiary">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#6DF5E3" }} /> Action</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "#A4D2EC" }} /> Result</span>
        <span className="ml-auto">{schedule.length} scheduled task{schedule.length === 1 ? "" : "s"} stored on this device</span>
      </div>
    </div>
  );
}