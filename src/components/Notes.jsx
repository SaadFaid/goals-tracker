import { useEffect, useRef, useState } from "react";
import { IconClose } from "./Icons";

const STORAGE_KEY = "august-goals-notes";
const DAYS_KEY = "august-goals-notes-days";
const ROW_H = 30;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const monthDays = (key) => {
  const [y, m] = key.split("-").map(Number);
  return y && m ? new Date(y, m, 0).getDate() : 30;
};
const dk = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function dayLabel(dayKey) {
  const [y, m, d] = (dayKey || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  let suffix = "th";
  if (d % 10 === 1 && d % 100 !== 11) suffix = "st";
  else if (d % 10 === 2 && d % 100 !== 12) suffix = "nd";
  else if (d % 10 === 3 && d % 100 !== 13) suffix = "rd";
  return `${MONTHS[m - 1]} ${d}${suffix}, ${y}`;
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    return items.filter((n) => n && typeof n.text === "string");
  } catch {
    return [];
  }
}

// Per-day history of the checklist: { lastDay: "YYYY-MM-DD", map: { date: [{id,text,done}] } }.
function loadDayRec() {
  try {
    const raw = localStorage.getItem(DAYS_KEY);
    if (!raw) return { lastDay: null, map: {} };
    const obj = JSON.parse(raw);
    return {
      lastDay: typeof obj?.lastDay === "string" ? obj.lastDay : null,
      map: obj?.map && typeof obj.map === "object" ? obj.map : {},
    };
  } catch {
    return { lastDay: null, map: {} };
  }
}

function todayKeyOf(d = new Date()) {
  return dk(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export default function Notes() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(() => loadNotes());
  const [dayRec, setDayRec] = useState(() => loadDayRec());
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  // "list" = the live checklist; "days" = saved days history.
  const [view, setView] = useState("list");
  const [gridYear, setGridYear] = useState(new Date().getFullYear());
  const [gridMonth, setGridMonth] = useState(new Date().getMonth());
  const [activeDay, setActiveDay] = useState(null);
  const inputRef = useRef(null);
  const dragId = useRef(null);
  const justDragged = useRef(false);
  const latestNotes = useRef(notes);

  useEffect(() => {
    latestNotes.current = notes;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  // Archive the previous day's checklist on day rollover (on open/mount, like
  // the store's daily reset). The current day's list is saved under its own
  // date the next time a new day is opened — starts saving from today.
  useEffect(() => {
    const tk = todayKeyOf();
    setDayRec((prev) => {
      const map = { ...(prev?.map || {}) };
      if (prev?.lastDay && prev.lastDay !== tk && !map[prev.lastDay]) {
        map[prev.lastDay] = latestNotes.current.map((n) => ({
          id: n.id,
          text: n.text,
          done: !!n.done,
        }));
      }
      return { lastDay: tk, map };
    });
  }, [open]);

  useEffect(() => {
    localStorage.setItem(DAYS_KEY, JSON.stringify(dayRec));
  }, [dayRec]);

  useEffect(() => {
    if (open && view === "list") inputRef.current?.focus();
  }, [open, view]);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((prev) => [...prev, { id: crypto.randomUUID(), text, done: false }]);
    setDraft("");
  };

  const toggleNote = (id) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
  };

  const removeNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const saveEdit = (id, text) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
    setEditingId(null);
  };

  // HTML5 drag reorder — hold a row and move it.
  const onRowDragStart = (e, id) => {
    dragId.current = id;
    justDragged.current = false;
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onRowDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragId.current || dragId.current === id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    setNotes((prev) => {
      const from = prev.findIndex((n) => n.id === dragId.current);
      const to = prev.findIndex((n) => n.id === id);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      const toIdx = next.findIndex((n) => n.id === id);
      next.splice(before ? toIdx : toIdx + 1, 0, moved);
      return next;
    });
  };

  const onRowDragEnd = () => {
    // suppress a stray click right after a drop
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
      dragId.current = null;
    }, 0);
  };

  const doneCount = notes.filter((n) => n.done).length;

  // ── Days history helpers ───────────────────────────
  const dayMap = dayRec?.map || {};
  const dayKeys = Object.keys(dayMap)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const active = activeDay || dayKeys[0] || null;
  const gridTotal = monthDays(monthKey(gridYear, gridMonth + 1));
  const gridLeading = new Date(gridYear, gridMonth, 1).getDay();
  const now = new Date();
  const todayKey = dk(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const openDays = () => {
    setGridMonth(now.getMonth());
    setGridYear(now.getFullYear());
    setActiveDay(dayKeys[0] || null);
    setView("days");
    setEditMode(false);
  };

  const shiftGridMonth = (delta) => {
    let m = gridMonth + delta;
    let y = gridYear;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    setGridMonth(m);
    setGridYear(y);
  };

  const scrollDay = (dir) => {
    if (dayKeys.length === 0) return;
    const idx = dayKeys.indexOf(active);
    const nxt = Math.max(0, Math.min(dayKeys.length - 1, idx + dir));
    if (dayKeys[nxt]) setActiveDay(dayKeys[nxt]);
  };

  return (
    <>
      <div className="fixed bottom-5 left-5 z-40 flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm"
          style={{
            background: "var(--color-elevated)",
            color: "var(--color-accent)",
            border: "1px solid var(--color-border-active)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
          }}
          aria-label="Open checklist"
          title="Checklist"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 4h16v16H4z" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
          Checklist
          {notes.length > 0 && (
            <span
              className="grid place-items-center min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold"
              style={{ background: "var(--color-accent)", color: "#101010" }}
            >
              {doneCount}/{notes.length}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          className="notes-backdrop-in fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,31,30,0.32)", backdropFilter: "blur(12px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="notes-pop w-full max-w-[540px] max-h-[84vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(109,245,227,0.16)",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.4), 0 30px 70px rgba(0,0,0,0.65), 0 6px 18px rgba(0,0,0,0.45), 0 0 40px rgba(109,245,227,0.10)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glass navbar — matches the site's floating controls card */}
            <div
              className="relative flex items-center justify-between gap-3 px-5 py-3"
              style={{
                background: "linear-gradient(180deg, rgba(32,85,74,0.5), rgba(30,59,52,0.42))",
                backdropFilter: "blur(18px) saturate(1.6)",
                WebkitBackdropFilter: "blur(18px) saturate(1.6)",
                borderBottom: "1px solid var(--color-border-subtle)",
                boxShadow:
                  "inset 0 1px 0 rgba(229,246,240,0.07), 0 6px 16px rgba(0,0,0,0.35)",
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
                  style={{
                    background: "var(--color-accent-muted)",
                    color: "var(--color-accent)",
                    boxShadow: "0 0 16px rgba(109,245,227,0.35)",
                  }}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16v16H4z" />
                    <path d="M8 8h8M8 12h8M8 16h5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold leading-none" style={{ color: "#8FFFF2", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                    {view === "days" ? "Days history" : "Checklist"}
                  </h2>
                  <p className="text-[10px] mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                    {view === "days"
                      ? "tap a day to see what you typed and checked"
                      : editMode
                        ? "edit, delete or drag to reorder"
                        : "tick a line when it's done"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => (view === "days" ? setView("list") : openDays())}
                  aria-pressed={view === "days"}
                  title={view === "days" ? "Back to today's checklist" : "Saved days history"}
                  className="grid place-items-center w-7 h-7 rounded-lg cursor-pointer transition-colors"
                  style={{
                    color: view === "days" ? "#101010" : "var(--color-accent)",
                    background: view === "days" ? "var(--color-accent)" : "var(--color-sunken)",
                    boxShadow: view === "days" ? "0 0 16px rgba(109,245,227,0.4)" : "none",
                  }}
                >
                  {view === "days" ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <line x1="8" y1="3" x2="8" y2="7" />
                      <line x1="16" y1="3" x2="16" y2="7" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  )}
                </button>
                {notes.length > 0 && view !== "days" && (
                  <span
                    className="h-6 px-2.5 rounded-full grid place-items-center text-[11px] font-bold tabular-nums"
                    style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
                  >
                    {doneCount}/{notes.length}
                  </span>
                )}
                {view === "list" && (
                  <button
                    onClick={() => setEditMode((m) => !m)}
                    aria-pressed={editMode}
                    title={editMode ? "Exit edit mode" : "Edit tasks"}
                    className="grid place-items-center w-7 h-7 rounded-lg cursor-pointer transition-colors"
                    style={{
                      color: editMode ? "#101010" : "var(--color-accent)",
                      background: editMode ? "var(--color-accent)" : "var(--color-sunken)",
                      boxShadow: editMode ? "0 0 16px rgba(109,245,227,0.4)" : "none",
                    }}
                  >
                    {editMode ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 13l4 4 10-10" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close notes"
                  className="grid place-items-center w-7 h-7 rounded-lg cursor-pointer transition-colors"
                  style={{ color: "var(--color-text-secondary)", background: "var(--color-sunken)" }}
                >
                  <IconClose size={13} />
                </button>
              </div>
              <span
                aria-hidden="true"
                className="absolute left-5 right-5 bottom-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(109,245,227,0.5), transparent)" }}
              />
            </div>

            {/* The paper — ruled lines, red margin, one per task line */}
            {view === "days" ? (
              <div
                className="flex-1 overflow-y-auto"
                style={{
                  background: "var(--color-elevated)",
                  backdropFilter: "blur(18px) saturate(1.6)",
                  WebkitBackdropFilter: "blur(18px) saturate(1.6)",
                  padding: 16,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => shiftGridMonth(-1)} className="stepper-btn" aria-label="Previous month">‹</button>
                    <span className="mono text-heading text-sm w-28 text-center">{MONTHS[gridMonth]} {gridYear}</span>
                    <button type="button" onClick={() => shiftGridMonth(1)} className="stepper-btn" aria-label="Next month">›</button>
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="text-center text-[10px] uppercase tracking-wide text-text-tertiary">{w}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: gridLeading }).map((_, i) => (
                    <span key={`b${i}`} aria-hidden="true" />
                  ))}
                  {Array.from({ length: gridTotal }).map((_, i) => {
                    const d = i + 1;
                    const key = dk(gridYear, gridMonth + 1, d);
                    const saved = !!dayMap[key];
                    const isSel = key === active;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!saved}
                        onClick={() => setActiveDay(key)}
                        className={`relative aspect-square rounded-lg grid place-items-center text-xs transition-colors ${
                          saved
                            ? "text-heading hover:bg-accent-muted cursor-pointer"
                            : "text-text-tertiary/50 cursor-default"
                        } ${isSel ? "bg-accent text-navy-900 font-semibold" : key === todayKey ? "ring-1 ring-accent" : ""}`}
                        title={saved ? `Open ${dayLabel(key)}` : dayLabel(key)}
                      >
                        <span>{d}</span>
                        {saved && !isSel && (
                          <span
                            className="absolute bottom-0.5 w-1 h-1 rounded-full"
                            style={{ background: "var(--color-accent)" }}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" onClick={() => scrollDay(-1)} disabled={!active} className="stepper-btn" aria-label="Previous day">‹</button>
                    <span className="text-xs font-semibold text-heading">{active ? dayLabel(active) : "No saved days"}</span>
                    <button type="button" onClick={() => scrollDay(1)} disabled={!active} className="stepper-btn" aria-label="Next day">›</button>
                  </div>
                  {dayKeys.length === 0 ? (
                    <p className="text-sm text-muted">
                      No saved days yet — each day's checklist is saved from today onward.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(dayMap[active] || []).map((n) => (
                        <div key={n.id} className="flex items-end gap-2" style={{ height: ROW_H }}>
                          <span
                            className="grid place-items-center shrink-0"
                            style={{
                              width: 16,
                              height: 16,
                              marginBottom: 7,
                              borderRadius: 4,
                              border: "2px solid " + (n.done ? "#0E7A6B" : "var(--color-border-active)"),
                              background: n.done ? "#0E7A6B" : "transparent",
                            }}
                          >
                            {n.done && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                                <path d="M5 13l4 4 10-10" stroke="#FFFDF5" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span
                            className="flex-1 min-w-0 truncate text-[15px]"
                            style={{
                              color: n.done ? "var(--color-text-tertiary)" : "var(--color-heading)",
                              textDecoration: n.done ? "line-through" : undefined,
                              textDecorationColor: "var(--color-text-tertiary)",
                              paddingBottom: 2,
                            }}
                          >
                            {n.text}
                          </span>
                        </div>
                      ))}
                      <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                        {active} <span style={{ opacity: 0.7 }}>· {dayMap[active]?.filter((x) => x.done).length || 0}/{dayMap[active]?.length || 0} done</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
            <div
              className="notes-sheet flex-1 overflow-y-auto"
              style={{ paddingLeft: 28, paddingRight: 22, paddingTop: 0, paddingBottom: 6 }}
            >
              <div style={{ paddingRight: 10 }}>
              {notes.length === 0 ? (
                <p className="text-sm" style={{ color: "#A1998A", height: ROW_H, lineHeight: `${ROW_H - 3}px`, paddingBottom: 2 }}>
                  Add a task below — a new line appears on the paper.
                </p>
              ) : (
                notes.map((n) =>
                  editingId === n.id ? (
                    <EditNote
                      key={n.id}
                      initial={n.text}
                      onSave={(text) => saveEdit(n.id, text)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div
                      key={n.id}
                      draggable={editMode}
                      onDragStart={(e) => onRowDragStart(e, n.id)}
                      onDragOver={(e) => onRowDragOver(e, n.id)}
                      onDragEnd={onRowDragEnd}
                      onDrop={(e) => e.preventDefault()}
                      className={`flex items-end gap-2 ${
                        editMode ? "group cursor-grab active:cursor-grabbing select-none" : ""
                      }`}
                      style={{ height: ROW_H }}
                    >
                      <span
                        className="grid place-items-center shrink-0"
                        style={{
                          width: 16,
                          height: 16,
                          marginBottom: 7,
                          borderRadius: 4,
                          border: "2px solid " + (n.done ? "#0E7A6B" : "#C9BCA4"),
                          background: n.done ? "#0E7A6B" : "transparent",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNote(n.id);
                        }}
                      >
                        {n.done && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                            <path d="M5 13l4 4 10-10" stroke="#FFFDF5" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span
                        className="flex-1 min-w-0 truncate text-[15px]"
                        style={{
                          color: n.done ? "#ABA08C" : "#33291B",
                          textDecoration: n.done ? "line-through" : undefined,
                          textDecorationColor: "#ABA08C",
                          paddingBottom: 2,
                        }}
                        onClick={(e) => {
                          if (justDragged.current || editMode) return;
                          e.stopPropagation();
                          toggleNote(n.id);
                        }}
                      >
                        {n.text}
                      </span>

                      {editMode ? (
                        <>
                          {/* Edit + delete + drag handle — only in edit mode */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(n.id);
                            }}
                            title="Edit"
                            aria-label="Edit"
                            className="grid place-items-center w-6 h-6 rounded shrink-0 cursor-pointer opacity-50 hover:opacity-100"
                            style={{ marginBottom: 4, color: "#0E7A6B" }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNote(n.id);
                            }}
                            title="Delete"
                            aria-label="Delete"
                            className="grid place-items-center w-6 h-6 rounded shrink-0 cursor-pointer opacity-50 hover:opacity-100"
                            style={{ marginBottom: 4, color: "#DB6088" }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                            </svg>
                          </button>
                        </>
                      ) : null}
                    </div>
                  )
                )
              )}
              </div>
            </div>
            )}

            {/* Glass footer — matches the site, input + accent Add */}
            {view === "list" && (
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{
                background: "linear-gradient(180deg, rgba(32,85,74,0.5), rgba(30,59,52,0.42))",
                backdropFilter: "blur(18px) saturate(1.6)",
                WebkitBackdropFilter: "blur(18px) saturate(1.6)",
                borderTop: "1px solid var(--color-border-subtle)",
                boxShadow:
                  "inset 0 -1px 0 rgba(229,246,240,0.05), 0 -6px 16px rgba(0,0,0,0.35)",
              }}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNote();
                }}
                placeholder="Write a task… press Enter"
                className="flex-1 bg-sunken text-heading text-sm rounded-lg px-3 py-2 outline-none min-w-0"
                style={{ border: "1px solid var(--color-border-subtle)" }}
              />
              <button
                onClick={addNote}
                className="h-9 px-4 rounded-lg font-bold text-sm shrink-0 cursor-pointer"
                style={{ background: "var(--color-accent)", color: "#101010" }}
              >
                Add
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EditNote({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  const ref = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = (save) => {
    if (done.current) return;
    done.current = true;
    if (save && value.trim()) onSave(value.trim());
    else onCancel();
  };

  return (
    <div className="flex items-end gap-2.5" style={{ height: ROW_H, paddingBottom: 3 }}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit(true);
          else if (e.key === "Escape") commit(false);
        }}
        onBlur={() => commit(true)}
        className="flex-1 min-w-0 px-2 rounded-md text-[15px] outline-none"
        style={{
          background: "#EDF6F3",
          border: "1px solid #0E7A6B",
          color: "#33291B",
          height: 24,
        }}
      />
    </div>
  );
}