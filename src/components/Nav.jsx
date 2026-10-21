import { useGoalsStore } from "../store/useGoalsStore";
import Brand from "./Brand";
import Avatar from "./Avatar";
import { IconCheck, IconPencil } from "./Icons";
import MonthPicker from "./MonthPicker";

export default function Nav({ view = "dashboard", onSetView, onOpenLeaderboard, onOpenSettings }) {
  const isGuest = useGoalsStore((s) => s.isGuest);
  const openAuth = useGoalsStore((s) => s.openAuth);
  const editMode = useGoalsStore((s) => s.editMode);
  const toggleEditMode = useGoalsStore((s) => s.toggleEditMode);

  const signedIn = !isGuest;
  const isServerBacked = useGoalsStore((s) => s.isServerBacked === true);

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
    <>
      {/* Row 1 — brand + account. In normal flow, scrolls away. */}
      <header className="mx-auto max-w-[1100px] px-3 sm:px-5 pt-2 pb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Brand withMark size="sm" />
          <span className="relative flex w-2.5 h-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: "var(--color-accent)", animation: "brandPulse 2.4s ease-in-out infinite" }} />
            <span className="relative inline-flex rounded-full" style={{ width: 8, height: 8, margin: "auto", background: "var(--color-accent)" }} />
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {signedIn ? (
            <>
              {!isServerBacked && (
                <span
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full"
                  style={{ background: "rgba(245, 158, 11, 0.15)", color: "#FBBF24", border: "1px solid rgba(245, 158, 11, 0.35)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FBBF24" }} aria-hidden="true" />
                  Offline · saving on device
                </span>
              )}
              <Avatar onClick={() => onOpenSettings?.()} />
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
      </header>

      {/* Row 2 — month + control deck. A floating card, pinned to the top. */}
      <div className="sticky top-0 z-40 px-3 sm:px-5 pt-2 pb-3">
        <div className="controls-card mx-auto max-w-[1100px] rounded-2xl flex items-center justify-center gap-2 flex-wrap px-3 py-2">
          <MonthPicker />
          <span className="nav-divider" aria-hidden="true" />
          <div className="flex items-center gap-2 flex-wrap justify-end controls-actions">
            <button
              type="button"
              onClick={() => onOpenLeaderboard?.()}
              className="nav-btn"
              title="Leaderboard — ranked by streak"
              style={pill(false)}
            >
              <span style={{ color: "var(--color-accent)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 21V13M12 21V4M18 21v-6" />
                </svg>
              </span>
              Leaderboard
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
          </div>
        </div>
      </div>

    </>
  );
}