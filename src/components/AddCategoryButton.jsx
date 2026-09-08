import { useState } from "react";
import { CATEGORY_COLORS, CATEGORY_COLOR_KEYS } from "../lib/categoryColors";

export default function AddCategoryButton({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dotColor, setDotColor] = useState("turquoise");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), dotColor });
    setName("");
    setDotColor("turquoise");
    setOpen(false);
  };

  return (
    <div className="rounded-xl border border-dashed p-2 mt-1" style={{ borderColor: "var(--color-border-subtle)" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="card card-lift btn-lift w-full rounded-xl px-4 py-4 flex items-center justify-center gap-3 text-base font-semibold text-heading"
          style={{ background: "var(--color-sunken)" }}
        >
          <span
            className="w-8 h-8 rounded-full border border-dashed flex items-center justify-center text-xl leading-none"
            style={{ borderColor: "var(--color-border-active)" }}
            aria-hidden="true"
          >
            +
          </span>
          Add category
        </button>
      ) : (
        <form onSubmit={submit} className="slide-down flex flex-col gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="w-full bg-sunken text-heading text-sm rounded-lg px-3 py-2 outline-none"
            style={{ border: "1px solid var(--color-border-subtle)" }}
          />
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDotColor(key)}
                  aria-label={CATEGORY_COLORS[key].label}
                  title={CATEGORY_COLORS[key].label}
                  className="w-5 h-5 rounded-full border cursor-pointer"
                  style={{
                    background: CATEGORY_COLORS[key].hex,
                    borderColor:
                      key === "white"
                        ? "rgba(229,246,240,0.3)"
                        : "rgba(109,245,227,0.35)",
                    outline: dotColor === key ? "2px solid var(--color-accent)" : "none",
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg text-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{
                  background: "var(--color-accent)",
                  color: "#000",
                  opacity: name.trim() ? 1 : 0.5,
                }}
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
