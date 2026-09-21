import { useEffect, useRef, useState } from "react";
import { IconClose } from "./Icons";

const STORAGE_KEY = "august-goals-notes";
const ROW_H = 30;

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

const lineBg = {
  backgroundImage: `repeating-linear-gradient(transparent 0 ${ROW_H - 1}px, rgba(80,120,160,0.28) ${ROW_H - 1}px ${ROW_H}px)`,
};

export default function Notes() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(() => loadNotes());
  const [draft, setDraft] = useState("");
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const inputRef = useRef(null);
  const dragId = useRef(null);
  const justDragged = useRef(false);
  const paperRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!menuId) return;
    const close = (e) => {
      if (!paperRef.current?.contains(e.target)) setMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuId]);

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
    if (menuId === id) setMenuId(null);
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
    // suppress the click-to-menu right after a drop
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
      dragId.current = null;
    }, 0);
  };

  const doneCount = notes.filter((n) => n.done).length;

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
          aria-label="Open notes"
          title="Notes"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 4h16v16H4z" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
          Notes
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,31,30,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[540px] max-h-[84vh] flex flex-col rounded-xl overflow-hidden"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-2.5"
              style={{ background: "#FDFAF2", borderBottom: "1px solid rgba(0,0,0,0.1)" }}
            >
              <h2 className="text-lg font-bold" style={{ color: "#2A2116", fontFamily: "var(--font-display)" }}>
                Notes
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close notes"
                className="cursor-pointer text-[#8a7f6a] hover:text-[#2A2116]"
              >
                <IconClose size={14} />
              </button>
            </div>

            {/* The paper — ruled lines every ROW_H px, one per task line */}
            <div ref={paperRef} className="flex-1 overflow-y-auto px-6 pt-2 pb-2" style={{ ...lineBg, backgroundColor: "#FFFDF5" }}>
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
                      draggable
                      onDragStart={(e) => onRowDragStart(e, n.id)}
                      onDragOver={(e) => onRowDragOver(e, n.id)}
                      onDragEnd={onRowDragEnd}
                      onDrop={(e) => e.preventDefault()}
                      onClick={() => {
                        if (justDragged.current) return;
                        setMenuId(menuId === n.id ? null : n.id);
                      }}
                      className="flex items-end gap-2.5 group cursor-grab active:cursor-grabbing select-none"
                      style={{ position: "relative", height: ROW_H }}
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
                          cursor: "pointer",
                          paddingBottom: 2,
                        }}
                      >
                        {n.text}
                      </span>
                      <span
                        className="shrink-0 text-[#C9BCA4] group-hover:text-[#A1998A]"
                        style={{ marginBottom: 6 }}
                        aria-hidden="true"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="19" cy="12" r="1.8" />
                        </svg>
                      </span>

                      {menuId === n.id && (
                        <div
                          className="absolute right-5 bottom-full mb-1 flex items-center gap-1.5"
                          style={{
                            background: "#FFF",
                            border: "1px solid #E2D9C2",
                            borderRadius: 8,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
                            padding: "3px 4px",
                            zIndex: 5,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setMenuId(null);
                              setEditingId(n.id);
                            }}
                            title="Edit"
                            aria-label="Edit"
                            className="grid place-items-center w-7 h-7 rounded-md cursor-pointer hover:bg-[#EDF6F3]"
                            style={{ color: "#0E7A6B" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeNote(n.id)}
                            title="Delete"
                            aria-label="Delete"
                            className="grid place-items-center w-7 h-7 rounded-md cursor-pointer hover:bg-[#FBEFF3]"
                            style={{ color: "#DB6088" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )
              )}
            </div>

            {/* Add line */}
            <div
              className="px-6 py-3 flex items-center gap-2"
              style={{ background: "#FDFAF2", borderTop: "1px solid rgba(0,0,0,0.1)" }}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addNote();
                }}
                placeholder="Write a task… press Enter"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none min-w-0"
                style={{ background: "#FFF", border: "1px solid #E2D9C2", color: "#33291B" }}
              />
              <button
                onClick={addNote}
                className="h-9 px-4 rounded-lg font-bold text-sm shrink-0 cursor-pointer"
                style={{ background: "#0E7A6B", color: "#FFFDF5" }}
              >
                Add
              </button>
            </div>
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