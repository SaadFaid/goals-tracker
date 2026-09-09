import { useMemo, useState } from "react";
import { usePlanStore } from "../store/usePlanStore";

const HOUR_START = 6;   // first visible hour
const HOUR_END = 23;    // last visible hour
const HOUR_PX = 60;     // grid height per hour (px)
const GRID_START_MIN = HOUR_START * 60;
const GRID_TOTAL_MIN = (HOUR_END - HOUR_START) * 60;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPE_COLORS = { action: "#6DF5E3", result: "#A4D2EC" };

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
  const removeSlot = usePlanStore((s) => s.removeSlot);

  const [mode, setMode] = useState("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ taskKey: "", date: dayKey(new Date()), start: "09:00", end: "10:00" });
  const [err, setErr] = useState("");

  const options = useMemo(() => taskOptions(categories), [categories]);

  const rows =
    useMemo(
      () =>
        schedule.map((r) => {
          // Resolve live label/category so renames/deletes stay honest.
          const cat = (categories || []).find((c) => c.id === r.catId);
          const list = cat ? cat[r.type + "s"] || [] : [];
          const task = list[r.idx];
          if (!task || task._deleted) return null;
          return { ...r, label: task.label || r.label, catName: cat.name || r.catName, cat };
        }),
      [schedule, categories]
    ).filter(Boolean);

  const byDate = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.date)) m.set(r.date, []);
      m.get(r.date).push(r);
    }
    return m;
  }, [rows]);

  const submit = () => {
    if (!form.taskKey) return setErr("Pick a task first.");
    const a = toMin(form.start);
    const b = toMin(form.end);
    if (b <= a) return setErr("End time must be after start time.");
    const opt = options.find((o) => o.key === form.taskKey);
    if (!opt) return setErr("That task no longer exists.");
    addSlot({
      catId: opt.catId,
      type: opt.type,
      idx: opt.idx,
      label: opt.label,
      catName: opt.catName,
      date: form.date,
      start: form.start || "09:00",
      end: form.end || "10:00",
    });
    setErr("");
    setFormOpen(false);
  };

  const openFormFor = (date) => {
    const now = new Date();
    const startH = Math.max(HOUR_START, Math.min(HOUR_END - 1, now.getHours()));
    const pad = (n) => String(n).padStart(2, "0");
    setForm({
      ...form,
      date,
      start: `${pad(startH)}:00`,
      end: `${pad(startH + 1)}:00`,
    });
    setFormOpen(true);
  };

  const gridStyle = { position: "relative", height: (HOUR_END - HOUR_START) * HOUR_PX };

  const hourTop = (minutes) => ((minutes - GRID_START_MIN) / GRID_TOTAL_MIN) * 100;

  const inSlot = (row) => {
    const a = toMin(row.start);
    const b = Math.max(a + 15, toMin(row.end));
    const top = hourTop(a);
    const height = ((b - a) / GRID_TOTAL_MIN) * 100;
    return { top: `${top}%`, height: `${Math.max(height, 2.4)}%` };
  };

  const renderDayColumn = (date) => {
    const key = dayKey(date);
    const dayRows = byDate.get(key) || [];
    return (
      <div style={gridStyle} className="relative rounded-lg overflow-hidden" >
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => openFormFor(date)}
          title="Click to add a task"
        />
        {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
          const h = HOUR_START + i;
          return (
            <div
              key={h}
              className="absolute left-0 right-0"
              style={{ top: `${(i / (HOUR_END - HOUR_START)) * 100}%`, height: `${100 / (HOUR_END - HOUR_START)}%`, borderTop: "1px solid var(--color-border-subtle)" }}
            >
              <span className="absolute -top-2 left-1 text-[9px] font-mono text-text-tertiary">{h}:00</span>
            </div>
          );
        })}
        {dayRows.map((row) => {
          const pos = inSlot(row);
          const color = TYPE_COLORS[row.type] || "var(--color-accent)";
          return (
            <div
              key={row.id}
              className="absolute rounded-md px-1.5 py-0.5 overflow-hidden flex flex-col"
              style={{
                ...pos,
                left: "2%",
                width: "96%",
                background: row.type === "action" ? "rgba(109,245,227,0.16)" : "rgba(164,210,236,0.16)",
                borderLeft: `3px solid ${color}`,
                border: `1px solid ${color}44`,
                borderLeftWidth: 3,
              }}
              title={row.label}
            >
              <div className="flex items-center gap-0.5 min-w-0">
                <span className="text-[10px] font-semibold text-white truncate">{row.label}</span>
                <button
                  onClick={() => removeSlot(row.id)}
                  className="ml-auto shrink-0 text-white/50 hover:text-white/90 text-[10px] leading-none px-0.5 rounded hover:bg-white/10"
                  aria-label={`Remove ${row.label}`}
                >
                  ×
                </button>
              </div>
              <span className="text-[9px] opacity-60 mono">{row.start}–{row.end}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const weekStart = mondayOf(anchor);
  const monthGrid = useMemo(() => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const startDow = first.getDay() === 0 ? 7 : first.getDay(); // Mon=1
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 1 - startDow; i <= daysInMonth - startDow; i++) {
      const d = addDays(first, i - 1);
      const inMonth = d.getMonth() === m;
      cells.push({ date: d, inMonth });
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

  const controlBtn = {
    border: "1px solid var(--color-border-active)",
    color: "var(--color-text-secondary)",
  };

  return (
    <div className="page-container py-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="nav-btn"
          style={controlBtn}
          title="Back to dashboard"
        >
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
          onClick={() => (formOpen ? setFormOpen(false) : openFormFor(dayKey(anchor)))}
          className="nav-btn nav-btn-primary ml-auto"
          style={formOpen ? { background: "var(--color-sunken)", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border-active)" } : { background: "var(--color-accent)", color: "#101010" }}
        >
          {formOpen ? "Cancel" : "+ Add task"}
        </button>
      </div>

      {formOpen && (
        <div className="card p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-white">Schedule a task</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-[11px] text-text-tertiary">
              Task
              <select
                value={form.taskKey}
                onChange={(e) => setForm({ ...form, taskKey: e.target.value })}
                className="bg-sunken border border-border-subtle rounded-md px-2 py-1.5 text-xs text-white"
              >
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
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-sunken border border-border-subtle rounded-md px-2 py-1.5 text-xs text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-text-tertiary">
              Start
              <input
                type="time"
                step={900}
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                className="bg-sunken border border-border-subtle rounded-md px-2 py-1.5 text-xs text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-text-tertiary">
              End
              <input
                type="time"
                step={900}
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                className="bg-sunken border border-border-subtle rounded-md px-2 py-1.5 text-xs text-white"
              />
            </label>
          </div>
          {err && <div className="text-xs text-danger">{err}</div>}
          <div className="flex gap-2">
            <button onClick={submit} className="nav-btn nav-btn-primary" style={{ background: "var(--color-accent)", color: "#101010" }}>
              Add to schedule
            </button>
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
              const count = (byDate.get(key) || []).length;
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
                  {renderDayColumn(date)}
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
          {renderDayColumn(anchor)}
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