import { useState } from "react";

export default function Footer({ onReset, onCopyLastMonth }) {
  const [hint, setHint] = useState(null);

  const handleCopy = async () => {
    const copied = await onCopyLastMonth();
    if (copied) {
      setHint({ tone: "ok", text: "Copied last month's goals (progress reset)." });
    } else {
      setHint({ tone: "empty", text: "Nothing to copy — last month has no saved goals." });
    }
    setTimeout(() => setHint(null), 4000);
  };

  return (
    <footer className="text-center mt-4 pb-4 flex flex-col gap-3">
      <p className="text-muted text-xs leading-relaxed max-w-md mx-auto">
        Execution is your score — it counts only until you commit. Results are
        tracked but not what earns your rating.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 max-w-lg mx-auto w-full">
        <button
          onClick={onReset}
          className="card card-lift btn-lift rounded-xl px-4 py-4 flex items-center gap-3 text-left"
          style={{ background: "var(--color-sunken)" }}
        >
          <span className="text-2xl" aria-hidden="true">↺</span>
          <span className="flex flex-col">
            <span className="text-heading text-sm font-semibold">Reset all progress</span>
            <span className="text-text-tertiary text-xs">Zero out every action and result</span>
          </span>
        </button>

        <button
          onClick={handleCopy}
          className="card card-lift btn-lift rounded-xl px-4 py-4 flex items-center gap-3 text-left"
          style={{ background: "var(--color-sunken)" }}
        >
          <span className="text-2xl" aria-hidden="true">↗</span>
          <span className="flex flex-col">
            <span className="text-heading text-sm font-semibold">Copy goals from last month</span>
            <span className="text-text-tertiary text-xs">Reuse last month's targets, progress reset</span>
          </span>
        </button>
      </div>

      <p
        aria-live="polite"
        className={`text-sm font-medium ${hint ? "" : "opacity-0"}`}
        style={{
          color: hint?.tone === "ok" ? "var(--color-success)" : "var(--color-warning)",
          minHeight: "1.25rem",
        }}
      >
        {hint ? hint.text : "\u00A0"}
      </p>
    </footer>
  );
}
