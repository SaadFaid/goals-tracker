import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGoalsStore } from "../store/useGoalsStore";
import { Btn, Divider, SectionLabel, Select, Toggle } from "./ui";
import { initialOf } from "./Avatar";
import ChangePassword from "./ChangePassword";
import { BRAND } from "../lib/brand";
import { CURRENCIES, COUNTRIES } from "../lib/geo";
import { computeStreak, streakLabel } from "../lib/streak";
import { toast } from "../lib/toast";
import { IconExternal } from "./Icons";

const go = (hash) => {
  window.location.hash = hash;
};

/** Days left in the trial, created on first view so it is stable across reloads. */
function useTrialDaysLeft() {
  const settings = useGoalsStore((s) => s.settings);
  const setSettings = useGoalsStore((s) => s.setSettings);
  const [days, setDays] = useState(null);

  useEffect(() => {
    if (settings.plan !== "trial") {
      setDays(null);
      return;
    }
    let end = settings.trialEnds;
    if (!end) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      end = d.toISOString().slice(0, 10);
      setSettings({ trialEnds: end });
    }
    const left = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
    setDays(Math.max(0, left));
  }, [settings.plan, settings.trialEnds, setSettings]);

  return days;
}

/**
 * Settings: a right-side drawer on desktop, a bottom sheet on mobile.
 * Every preference saves the moment it is changed; the account-level ones
 * (leaderboard visibility, activity) are mirrored to the server.
 */
export default function SettingsPanel({ open, onClose, onOpenTour }) {
  const user = useGoalsStore((s) => s.user);
  const isGuest = useGoalsStore((s) => s.isGuest);
  const settings = useGoalsStore((s) => s.settings);
  const setSettings = useGoalsStore((s) => s.setSettings);
  const logout = useGoalsStore((s) => s.logout);
  const openDialog = useGoalsStore((s) => s.openDialog);
  const activityDays = useGoalsStore((s) => s.activityDays);
  const [rendered, setRendered] = useState(open);
  const [showPassword, setShowPassword] = useState(false);
  const panelRef = useRef(null);
  const trialDays = useTrialDaysLeft();
  const { streak } = computeStreak(activityDays);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return undefined;
    }
    if (!rendered) return undefined;
    const t = setTimeout(() => setRendered(false), 220);
    return () => clearTimeout(t);
  }, [open, rendered]);

  useEffect(() => {
    if (!rendered) return undefined;
    const body = document.body;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prev;
    };
  }, [rendered, onClose]);

  if (!rendered) return null;

  const signedIn = !!user && !isGuest;

  const save = (patch, message) => {
    setSettings(patch);
    if (message) toast(message);
  };

  const planLine = () => {
    if (settings.plan === "trial") {
      return trialDays == null
        ? "Free trial"
        : `Free trial · ${trialDays} ${trialDays === 1 ? "day" : "days"} left`;
    }
    const renews = settings.planUntil ? new Date(settings.planUntil).toLocaleDateString() : "—";
    return `${settings.plan === "yearly" ? "Yearly" : "Monthly"} · renews ${renews}`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[85] flex items-end sm:items-stretch sm:justify-end"
      style={{ background: "rgba(8,20,19,0.62)", backdropFilter: "blur(10px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="settings-drawer w-full sm:max-w-[420px] h-[92vh] sm:h-full flex flex-col overflow-hidden"
        style={{
          background: "var(--color-elevated)",
          borderLeft: "1px solid var(--color-border-active)",
          borderTop: "1px solid var(--color-border-active)",
          borderTopLeftRadius: "var(--radius-lg)",
          borderTopRightRadius: "var(--radius-lg)",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0" aria-hidden="true">
          <span className="block rounded-full" style={{ width: 38, height: 4, background: "var(--color-border-active)" }} />
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
          <h2 id="settings-title" className="h2 text-heading" style={{ fontSize: 17 }}>
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="grid place-items-center w-8 h-8 rounded-lg cursor-pointer"
            style={{ color: "var(--color-text-tertiary)", border: "1px solid var(--color-border-subtle)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grow overflow-y-auto px-5 py-4 flex flex-col gap-6">
          {/* ── Profile ── */}
          <section>
            <SectionLabel>Profile</SectionLabel>
            <div className="flex items-center gap-3">
              <span
                className="grid place-items-center rounded-full shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: "var(--color-accent-muted)",
                  border: "1px solid var(--color-accent)",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                  fontSize: 17,
                }}
              >
                {initialOf(isGuest ? { name: "Guest" } : user)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading truncate">
                  {isGuest ? "Guest" : user?.name || "No name yet"}
                </p>
                <p className="text-[11px] text-text-tertiary truncate">
                  {isGuest ? "Saved on this device only" : user?.email}
                </p>
              </div>
              <span
                className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
                title={streakLabel(streak)}
              >
                {streak ? `${streak}-day streak` : "no streak"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary">Country</span>
                <Select
                  value={settings.country || "OTHER"}
                  onChange={(v) => {
                    const c = COUNTRIES.find((x) => x.code === v);
                    save({ country: v, currency: c?.currency || settings.currency }, "Country saved");
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary">Currency</span>
                <Select value={settings.currency || "USD"} onChange={(v) => save({ currency: v }, "Currency saved")}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <label className="flex flex-col gap-1 mt-2">
              <span className="text-[10px] text-text-tertiary">Phone</span>
              <input
                value={settings.phone || ""}
                onChange={(e) => setSettings({ phone: e.target.value })}
                placeholder="+212 6 00 00 00 00"
                inputMode="tel"
                className="w-full bg-sunken text-heading text-sm rounded-lg px-3 py-2 outline-none"
                style={{ border: "1px solid var(--color-border-subtle)" }}
              />
            </label>

            {signedIn && settings.authProvider !== "google" ? (
              <div className="mt-3">
                {showPassword ? (
                  <div className="flex flex-col gap-2">
                    <ChangePassword />
                    <button
                      type="button"
                      onClick={() => setShowPassword(false)}
                      className="self-start text-[11px] cursor-pointer hover:underline"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPassword(true)}
                    className="text-xs cursor-pointer hover:underline"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Change password
                  </button>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                onClose?.();
                logout();
              }}
              className="mt-3 text-xs cursor-pointer hover:underline"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Sign out
            </button>
          </section>

          <Divider />

          {/* ── Plan ── */}
          <section>
            <SectionLabel>Plan</SectionLabel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-heading">{planLine()}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">Cancel anytime. No card on the trial.</p>
              </div>
              <Btn size="sm" variant="secondary" onClick={() => openDialog({ type: "plan" })}>
                Choose a plan
              </Btn>
            </div>
          </section>

          <Divider />

          {/* ── Reminders ── */}
          <section className="flex flex-col gap-3.5">
            <SectionLabel>Reminders</SectionLabel>
            <Toggle
              id="pl-reminders"
              label="Daily reminder"
              hint="A nudge in the evening if the day is still empty."
              checked={!!settings.emailReminders}
              onChange={(v) => save({ emailReminders: v })}
            />
            <Toggle
              id="pl-weekly"
              label="Weekly recap"
              hint="Where the month stands, every Sunday."
              checked={!!settings.emailWeekly}
              onChange={(v) => save({ emailWeekly: v })}
            />
            <Toggle
              id="pl-month"
              label="Month in review"
              hint="Your final numbers when the month closes."
              checked={!!settings.emailMonth}
              onChange={(v) => save({ emailMonth: v })}
            />
          </section>

          <Divider />

          {/* ── Privacy ── */}
          <section>
            <SectionLabel>Privacy</SectionLabel>
            <Toggle
              id="pl-hide-board"
              label="Hide me from the leaderboard"
              hint="Your row disappears for everyone. Your streak is kept."
              checked={!!settings.hideFromLeaderboard}
              onChange={(v) => save({ hideFromLeaderboard: v }, v ? "Hidden from the leaderboard" : "Visible on the leaderboard")}
            />
          </section>

          <Divider />

          {/* ── Help ── */}
          <section className="flex flex-col gap-2">
            <SectionLabel>Help</SectionLabel>
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenTour?.();
              }}
              className="text-left text-sm py-1 cursor-pointer hover:text-heading transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              How to use {BRAND.name}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose?.();
                go("#/");
              }}
              className="inline-flex items-center gap-1.5 text-left text-sm py-1 cursor-pointer hover:text-heading transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Main site <IconExternal size={12} />
            </button>
          </section>

          <Divider />

          {/* ── Danger zone ── */}
          <section>
            <SectionLabel>Danger zone</SectionLabel>
            <button
              type="button"
              onClick={() => openDialog({ type: "delete-account" })}
              className="text-xs font-semibold cursor-pointer hover:underline"
              style={{ color: "var(--color-danger)" }}
            >
              Delete account
            </button>
            <p className="text-[11px] text-text-tertiary mt-1">
              Removes your goals, progress and streak for good.
            </p>
          </section>
        </div>
      </aside>
    </div>,
    document.body
  );
}
