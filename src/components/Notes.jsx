import { useEffect, useRef, useState } from "react";
import { IconClose } from "./Icons";

const STORAGE_KEY = "august-goals-notes";

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

export default function Notes() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(() => loadNotes());
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((prev) => [...prev, { id: crypto.randomUUID(), text, done: false }]);
    setDraft("");
  };

  const toggleNote = (id) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, done: !n.done } : n))
    );
  };

  const removeNote = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
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
              style={{
                background: "#FDFAF2",
                borderBottom: "1px solid rgba(0,0,0,0.1)",
              }}
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

            {/* The paper — ruled lines, red margin, like a notebook sheet */}
            <div
              className="flex-1 overflow-y-auto px-6 pt-4 pb-2"
              style={{
                background:
                  "repeating-linear-gradient(transparent 0 27px, rgba(80,120,160,0.28) 27px 28px), #FFFDF5",
              }}
            >
              {notes.length === 0 ? (
                <p className="text-sm" style={{ color: "#A1998A", lineHeight: "27px", paddingBottom: 1 }}>
                  Add a task below — a new line appears on the paper.
                </p>
              ) : (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-end gap-2.5 group cursor-pointer"
                    style={{ minHeight: 28, paddingBottom: 1 }}
                    onClick={() => toggleNote(n.id)}
                  >
                    <span
                      className="grid place-items-center shrink-0"
                      style={{
                        width: 16,
                        height: 16,
                        marginBottom: 6,
                        borderRadius: 4,
                        border: "2px solid " + (n.done ? "#0E7A6B" : "#C9BCA4"),
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
                      className="flex-1 min-w-0 break-words text-[15px]"
                      style={{
                        color: n.done ? "#ABA08C" : "#33291B",
                        textDecoration: n.done ? "line-through" : undefined,
                        textDecorationColor: "#ABA08C",
                        lineHeight: "27px",
                        paddingBottom: 1,
                      }}
                    >
                      {n.text}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNote(n.id);
                      }}
                      aria-label="Delete note"
                      className="opacity-0 group-hover:opacity-100 cursor-pointer text-[#C9BCA4] hover:text-[#DB6088] shrink-0"
                      style={{ marginBottom: 5 }}
                    >
                      <IconClose size={13} />
                    </button>
                  </div>
                ))
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
                style={{
                  background: "#FFF",
                  border: "1px solid #E2D9C2",
                  color: "#33291B",
                }}
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