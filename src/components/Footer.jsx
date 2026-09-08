import { useState } from "react";

export default function Footer({ onReset, onCopyLastMonth, onEmptyMonth }) {
  const [hint, setHint] = useState(null);

  const notify = (tone, text) => {
    setHint({ tone, text });
    setTimeout(() => setHint(null), 4000);
  };

  const handleCopy = async () => {
    const copied = await onCopyLastMonth();
    if (copied) {
      notify("ok", "Copied the previous month's goals (progress reset).");
    } else {
      notify("empty", "Last month is empty — nothing to bring over.");
    }
  };

  const handleEmpty = () => {
    onEmptyMonth();
    notify("ok", "This month was cleared — all goals, stats and tasks removed.");
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
            <span className="text-text-tertiary text-xs">Reuse the previous month's targets, progress reset</span>
          </span>
        </button>
      </div>

      <button
        onClick={handleEmpty}
        className="self-center text-sm text-text-tertiary hover:text-danger underline-offset-4 hover:underline transition-colors"
      >
        Empty this month
      </button>

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
