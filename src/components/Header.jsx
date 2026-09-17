import { userData } from "../data/goals";
import { computeOverallPct } from "../lib/score";
import { useGoalsStore } from "../store/useGoalsStore";
import { IconTrophy, IconFire, IconThumb, IconRocket } from "./Icons";

export default function Header({ daysElapsed, categories }) {
  const viewingHistory = useGoalsStore((s) => s.viewingHistory);
  const goLive = useGoalsStore((s) => s.goLive);
  const daysElapsedSafe = daysElapsed ?? userData.daysPassed;

  const overallPct = categories ? Math.round(computeOverallPct(categories)) : 0;
  const timeProgress = Math.round((daysElapsedSafe / userData.totalDays) * 100);

  return (
    <header className="card card-lift flex flex-col justify-center gap-2 p-4" style={{
      background: "linear-gradient(135deg, var(--color-elevated), var(--color-surface))",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Add a decorative background element */}
      <div className="absolute inset-0" style={{
        pointerEvents: "none",
        background: `linear-gradient(45deg, transparent, var(--color-accent)10, transparent)`,
        transform: "rotate(45deg)",
        width: "200%",
        height: "200%",
        top: "-50%",
        left: "-50%",
        animation: "headerGlow 6s ease-in-out infinite"
      }}></div>

      <div className="relative z-10">
        <div>
          <h1 className="display text-heading">
            Tchizu Goal Tracker
          </h1>
          <p className="text-xs text-muted mt-1.5">
            {daysElapsedSafe} of {userData.totalDays} days in. Tap any number on any card to update it — your score recalculates instantly.
          </p>

          {/* Show goal progress if categories are provided, otherwise show time progress */}
          {categories && categories.length > 0 ? (
            <>
              <div className="w-full h-2 mb-2 bg-navy-500 rounded overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${overallPct}%` }}></div>
              </div>
              <p className="text-xs text-text-tertiary flex items-center gap-1.5">
                Goal progress: {overallPct}%
                {overallPct >= 100 ? (
                  <span className="inline-flex items-center gap-1 text-accent"><IconTrophy size={13} /> Goal achieved!</span>
                ) : overallPct >= 80 ? (
                  <span className="inline-flex items-center gap-1"><IconFire size={13} /> Almost there!</span>
                ) : overallPct >= 50 ? (
                  <span className="inline-flex items-center gap-1"><IconThumb size={13} /> Making progress!</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><IconRocket size={13} /> Getting started!</span>
                )}
              </p>
            </>
          ) : (
            <>
              <div className="w-full h-2 mb-2 bg-navy-500 rounded overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${timeProgress}%` }}></div>
              </div>
              <p className="text-xs text-text-tertiary">
                Time progress: {timeProgress}% ({daysElapsedSafe}/{userData.totalDays} days)
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
          {viewingHistory && (
            <button
              type="button"
              onClick={goLive}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer transition-colors"
              style={{ background: "rgba(255,161,77,0.15)", color: "#FFA14D" }}
              title="Back to the current month and continue editing"
            >
              ← Back to current month
            </button>
          )}

          <p className="caption" style={{ color: "var(--color-text-tertiary)" }}>
            Expected pace: {Math.round((daysElapsedSafe / userData.totalDays) * 100)}%
          </p>
        </div>
      </div>
    </header>
  );
}