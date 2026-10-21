import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useGoalsStore } from "../store/useGoalsStore";
import { IconFlame } from "./Icons";

// Everyone ranked by progress, best first. The percentage is the same
// overall-quality number each member sees on their own dashboard, so a row here
// matches what they are used to reading.
export default function Leaderboard({ onClose }) {
  const user = useGoalsStore((s) => s.user);
  const isGuest = useGoalsStore((s) => s.isGuest);
  const openAuth = useGoalsStore((s) => s.openAuth);
  const signedIn = !!user && !isGuest;

  const [state, setState] = useState({ loading: true, error: null, entries: null, total: 0 });

  useEffect(() => {
    // Signed-out members are handled in render; only a signed-in session talks
    // to the API, so no state is set synchronously here.
    if (!signedIn) return undefined;
    let alive = true;
    api
      .leaderboard()
      .then((res) => {
        if (!alive) return;
        setState({ loading: false, error: null, entries: res?.entries || [], total: res?.total || 0 });
      })
      .catch((err) => {
        if (!alive) return;
        setState({ loading: false, error: err?.message || "Could not load the leaderboard.", entries: null, total: 0 });
      });
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const entries = state.entries || [];

  const rankTone = (rank) =>
    rank === 1 ? "#E8B44B" : rank === 2 ? "#C9CDD4" : rank === 3 ? "#D08A54" : "var(--color-text-tertiary)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-subtle)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--color-heading)" }}>
              Leaderboard
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
              {state.loading
                ? "Loading…"
                : signedIn
                  ? `${entries.length} member${entries.length === 1 ? "" : "s"} · ranked by progress`
                  : "Sign in to compare progress"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close leaderboard"
            className="grid place-items-center w-7 h-7 rounded-lg cursor-pointer shrink-0"
            style={{ color: "var(--color-text-secondary)", background: "var(--color-sunken)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!signedIn ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              The leaderboard lists every account, so it only loads for a signed-in
              member. Guests keep their progress on this device.
            </p>
            <button
              onClick={() => {
                onClose();
                openAuth?.();
              }}
              className="nav-btn nav-btn-primary py-2"
              style={{ background: "var(--color-accent)", color: "#101010" }}
            >
              Log in
            </button>
          </div>
        ) : state.error ? (
          <p className="text-sm" style={{ color: "var(--color-danger, #e5484d)" }}>
            {state.error}
          </p>
        ) : state.loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: "var(--color-sunken)" }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            No accounts yet — you will be first on the board.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto pr-1">
            {entries.map((e) => (
              <li
                key={`${e.rank}-${e.name}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{
                  background: e.isYou ? "var(--color-accent-muted)" : "var(--color-sunken)",
                  border: e.isYou ? "1px solid var(--color-accent)" : "1px solid transparent",
                }}
              >
                <span
                  className="w-6 text-center text-xs font-bold tabular-nums shrink-0"
                  style={{ color: rankTone(e.rank) }}
                >
                  {e.rank}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm font-semibold" style={{ color: "var(--color-heading)" }}>
                  {e.name}
                  {e.isYou && (
                    <span className="ml-1.5 text-[10px] font-bold" style={{ color: "var(--color-accent)" }}>
                      YOU
                    </span>
                  )}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums shrink-0 w-8"
                  style={{ color: e.streak ? "var(--color-accent)" : "var(--color-text-tertiary)" }}
                  title={`${e.streak || 0}-day streak`}
                >
                  <IconFlame size={11} />
                  {e.streak || 0}
                </span>
                <span className="w-20 h-1.5 rounded-full shrink-0" style={{ background: "var(--color-border-subtle)" }}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${e.percent}%`, background: "var(--color-accent)" }}
                  />
                </span>
                <span
                  className="w-9 text-right text-xs font-bold tabular-nums shrink-0"
                  style={{ color: "var(--color-heading)" }}
                >
                  {e.percent}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
