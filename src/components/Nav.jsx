import { useGoalsStore } from "../store/useGoalsStore";
import { userData } from "../data/goals";

export default function Nav({ view = "dashboard", onSetView }) {
  const user = useGoalsStore((s) => s.user);
  const isGuest = useGoalsStore((s) => s.isGuest);
  const logout = useGoalsStore((s) => s.logout);
  const openAuth = useGoalsStore((s) => s.openAuth);
  const editMode = useGoalsStore((s) => s.editMode);
  const toggleEditMode = useGoalsStore((s) => s.toggleEditMode);

  const signedIn = !!user && !isGuest;

  return (
    <nav className="sticky top-0 z-20 site-nav rounded-b-2xl shadow-[0_12px_28px_rgba(0,0,0,0.4)]">
      <div
        className="mx-auto max-w-[1100px] px-4 sm:px-6 h-14 flex items-center justify-between gap-4"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="grid place-items-center w-7 h-7 rounded-lg shrink-0"
            style={{
              background: "var(--color-accent-muted)",
              color: "var(--color-accent)",
              boxShadow: "0 0 18px rgba(109,245,227,0.35)",
            }}
            aria-hidden="true"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span className="brand text-heading leading-none">Tchizu Goal Tracker</span>
          <span
            className="caption text-text-tertiary hidden sm:inline"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {userData.month} {userData.year} · {userData.totalDays} days
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onSetView?.(view === "plan" ? "dashboard" : "plan")}
            className="nav-btn"
            aria-pressed={view === "plan"}
            title={view === "plan" ? "Back to dashboard" : "Plan your day on a calendar"}
            style={{
              border: view === "plan" ? "1px solid var(--color-accent)" : "1px solid var(--color-border-active)",
              color: view === "plan" ? "var(--color-accent)" : "var(--color-text-secondary)",
              background: view === "plan" ? "var(--color-accent-muted)" : "transparent",
              boxShadow: view === "plan" ? "0 0 14px rgba(109,245,227,0.25)" : undefined,
            }}
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
            style={{
              border: editMode ? "1px solid var(--color-accent)" : "1px solid var(--color-border-active)",
              color: editMode ? "var(--color-accent)" : "var(--color-text-secondary)",
              background: editMode ? "var(--color-accent-muted)" : "transparent",
              boxShadow: editMode ? "0 0 14px rgba(109,245,227,0.25)" : undefined,
            }}
          >
            {editMode ? "✓ Done" : "✎ Edit"}
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
                style={{
                  border: "1px solid var(--color-border-active)",
                  color: "var(--color-text-secondary)",
                }}
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
