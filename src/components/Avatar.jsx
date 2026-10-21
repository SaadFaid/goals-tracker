import { useGoalsStore } from "../store/useGoalsStore";
import { computeStreak } from "../lib/streak";
import { IconFlame } from "./Icons";

/** First letter of the name, falling back to the email. */
export function initialOf(user) {
  const name = String(user?.name || "").trim();
  if (name) return name[0].toUpperCase();
  const email = String(user?.email || "").trim();
  return email ? email[0].toUpperCase() : "?";
}

/**
 * The circle in the top-right. Initial on an accent-tinted background, and it
 * opens Settings. The streak sits right beside it.
 */
export default function Avatar({ onClick, showStreak = true }) {
  const user = useGoalsStore((s) => s.user);
  const isGuest = useGoalsStore((s) => s.isGuest);
  const activityDays = useGoalsStore((s) => s.activityDays);
  const { streak } = computeStreak(activityDays);

  const name = isGuest ? "Guest" : user?.name || user?.email || "Account";

  return (
    <div className="flex items-center gap-2">
      {showStreak && streak > 0 ? (
        <span
          className="inline-flex items-center gap-1 px-2 h-7 rounded-full text-[11px] font-bold"
          style={{
            background: "var(--color-accent-muted)",
            color: "var(--color-accent)",
            border: "1px solid rgba(109,245,227,0.28)",
          }}
          title={`${streak}-day streak`}
        >
          <IconFlame size={12} />
          {streak}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onClick}
        aria-label={`Settings for ${name}`}
        title={name}
        className="grid place-items-center rounded-full cursor-pointer transition-transform hover:scale-105"
        style={{
          width: 32,
          height: 32,
          background: "var(--color-accent-muted)",
          border: "1px solid var(--color-accent)",
          color: "var(--color-accent)",
          fontWeight: 700,
          fontSize: 13,
          boxShadow: "0 0 14px rgba(109,245,227,0.22)",
        }}
      >
        {initialOf(isGuest ? { name: "Guest" } : user)}
      </button>
    </div>
  );
}
