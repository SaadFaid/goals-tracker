import { useGoalsStore } from "../store/useGoalsStore";
import { IconCheck, IconPencil, IconChart } from "./Icons";
import MonthPicker from "./MonthPicker";

export default function Nav({ view = "dashboard", onSetView, onOpenAnalysis }) {
  const user = useGoalsStore((s) => s.user);
  const isGuest = useGoalsStore((s) => s.isGuest);
  const logout = useGoalsStore((s) => s.logout);
  const openAuth = useGoalsStore((s) => s.openAuth);
  const editMode = useGoalsStore((s) => s.editMode);
  const toggleEditMode = useGoalsStore((s) => s.toggleEditMode);

  const signedIn = !!user && !isGuest;

  // Shared pill style — calm glass when off, mint glow when on.
  const pill = (active) => ({
    border: active ? "1px solid var(--color-accent)" : "1px solid var(--color-border-active)",
    color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
    background: active
      ? "var(--color-accent-muted)"
      : "linear-gradient(180deg, rgba(229,246,240,0.07), rgba(229,246,240,0.02))",
    boxShadow: active ? "0 0 16px rgba(109,245,227,0.30)" : "0 1px 2px rgba(0,0,0,0.3)",
  });

  return (
    <nav className="sticky top-0 z-20 site-nav rounded-b-2xl">
      <div
        className="mx-auto max-w-[1100px] px-3 sm:px-5 h-11 flex items-center justify-between gap-3"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="grid place-items-center w-6 h-6 rounded-lg shrink-0"
            style={{
              background: "var(--color-accent-muted)",
              color: "var(--color-accent)",
              boxShadow: "0 0 18px rgba(109,245,227,0.35)",
            }}
            aria-hidden="true"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span className="brand text-sm text-heading leading-none">Tchizu Goal Tracker</span>
          <span className="relative flex w-2.5 h-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: "var(--color-accent)", animation: "brandPulse 2.4s ease-in-out infinite" }} />
            <span className="relative inline-flex rounded-full" style={{ width: 8, height: 8, margin: "auto", background: "var(--color-accent)" }} />
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <MonthPicker />
          <button
            type="button"
            onClick={() => onOpenAnalysis?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all btn-lift text-xs font-bold text-heading"
            style={{
              background: "var(--color-accent-muted)",
              border: "1px solid var(--color-border-active)",
              boxShadow: "0 0 16px rgba(109,245,227,0.25)",
            }}
            title="Month analysis"
          >
            <span style={{ color: "var(--color-accent)" }}><IconChart size={12} /></span>
            Analysis
          </button>
          <button
            onClick={() => onSetView?.(view === "plan" ? "dashboard" : "plan")}
            className="nav-btn"
            aria-pressed={view === "plan"}
            title={view === "plan" ? "Back to dashboard" : "Plan your day on a calendar"}
            style={pill(view === "plan")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Plan
          </button>
          <button
            onClick={toggleEditMode}
            className="nav-btn"
            aria-pressed={editMode}
            title={editMode ? "Exit edit mode" : "Edit everything"}
            style={pill(editMode)}
          >
            {editMode ? (
              <span className="inline-flex items-center gap-1.5"><IconCheck size={13} /> Done</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><IconPencil size={12} /> Edit</span>
            )}
          </button>
          {signedIn ? (
            <>
              <span
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full"
                style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-success)" }} aria-hidden="true" />
                {user.name || user.email}
              </span>
              <button
                onClick={logout}
                className="nav-btn"
                style={pill(false)}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <span
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full"
                style={{ background: "var(--color-sunken)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-tertiary)" }}
              >
                Guest · this device
              </span>
              <button
                onClick={openAuth}
                className="nav-btn nav-btn-primary"
                style={{ background: "var(--color-accent)", color: "#101010" }}
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
