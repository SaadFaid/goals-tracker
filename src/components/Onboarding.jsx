import { useEffect, useMemo, useState } from "react";
import { useGoalsStore } from "../store/useGoalsStore";
import Brand from "./Brand";
import { Btn, Input, Select } from "./ui";
import { COUNTRIES, CURRENCIES, currencyOf, currentMonthLabel, detectRegion } from "../lib/geo";

/* ════════════════════════════════════════════════════════════
   Onboarding — eight short steps, saved as you go.
   ════════════════════════════════════════════════════════════ */

const AREAS = [
  { id: "health", label: "Health & fitness", category: "Health & Fitness" },
  { id: "money", label: "Money", category: "Finance" },
  { id: "work", label: "Work & career", category: "Business & Career" },
  { id: "learning", label: "Learning", category: "Learning" },
  { id: "faith", label: "Faith", category: "Faith & Religion" },
  { id: "family", label: "Family & friends", category: "Family & Social" },
  { id: "discipline", label: "Discipline & mind", category: "Discipline & Mind" },
  { id: "social", label: "Social media", category: "Social Media Presence" },
];

const GOALS = [
  { id: "workout", kind: "action", label: "Workout sessions", area: "health", target: 12, unit: "" },
  { id: "nospend", kind: "action", label: "No-spend days", area: "money", target: 10, unit: "" },
  { id: "deepwork", kind: "action", label: "Deep work sessions", area: "work", target: 20, unit: "sessions" },
  { id: "learninghours", kind: "action", label: "Learning hours", area: "learning", target: 20, unit: "h" },
  { id: "prayers", kind: "action", label: "Days with all prayers on time", area: "faith", target: 31, unit: "" },
  { id: "familytime", kind: "action", label: "Quality time with family", area: "family", target: 8, unit: "" },
  { id: "early", kind: "action", label: "Days waking up before 7am", area: "discipline", target: 20, unit: "" },
  { id: "content", kind: "action", label: "Content pieces posted", area: "social", target: 8, unit: "" },
  { id: "clients", kind: "result", label: "New clients won", area: "work", target: 3, unit: "" },
  { id: "earned", kind: "result", label: "Money earned", area: "money", target: 1000, unit: "" },
  { id: "weight", kind: "result", label: "Weight", area: "health", target: 72, unit: "kg" },
  { id: "saved", kind: "result", label: "Money saved", area: "money", target: 500, unit: "" },
  { id: "revenue", kind: "result", label: "Revenue this month", area: "work", target: 500, unit: "" },
  { id: "skill", kind: "result", label: "New skill applied in a real project", area: "learning", target: 1, unit: "" },
];

const STATUSES = ["Employee", "Entrepreneur", "Freelancer", "Student", "Other"];
const CADENCES = [
  { id: "daily", label: "Every day", hint: "A short check-in each evening" },
  { id: "few", label: "A few times a week", hint: "More relaxed, but regular" },
  { id: "weekly", label: "Once a week", hint: "A Sunday catch-up" },
  { id: "own", label: "I will do it on my own", hint: "No reminders, thank you" },
];
const HEARD_FROM = [
  "Tchizu on social media",
  "A friend",
  "AI search (ChatGPT, Gemini...)",
  "Google",
  "Ads",
  "Other",
];

const areaLabel = (id) => AREAS.find((a) => a.id === id)?.label || id;
const areaCategory = (id) => AREAS.find((a) => a.id === id)?.category || id;
const goalById = (id) => GOALS.find((g) => g.id === id);

export default function Onboarding({ onFinish }) {
  const user = useGoalsStore((s) => s.user);
  const onboarding = useGoalsStore((s) => s.onboarding);
  const setOnboarding = useGoalsStore((s) => s.setOnboarding);
  const logout = useGoalsStore((s) => s.logout);
  const [busy, setBusy] = useState(false);

  const step = onboarding.step || 0;
  const monthLabel = currentMonthLabel();

  // Prefill the device's country and currency once.
  useEffect(() => {
    if (onboarding.country) return;
    const guess = detectRegion();
    setOnboarding({ country: guess.code, currency: guess.currency });
  }, [onboarding.country, setOnboarding]);

  const firstName = (user?.name || "").split(" ")[0] || "there";

  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const valid = useMemo(() => {
    switch (step) {
      case 0: return (onboarding.areas || []).length > 0;
      case 1: return !!onboarding.cadence;
      case 2: return !!onboarding.status;
      case 3: return !!onboarding.country && !!onboarding.currency;
      case 4: return onboarding.phone.trim().length >= 6;
      case 5: return !!onboarding.heardFrom;
      case 6: return (onboarding.goals || []).length > 0;
      case 7: return (onboarding.goals || []).length > 0;
      default: return true;
    }
  }, [step, onboarding]);

  const applyToTracker = () => {
    const store = useGoalsStore.getState();
    const areas = onboarding.areas || [];
    const goals = onboarding.goals || [];
    const targets = onboarding.targets || {};

    // 1. Keep only the areas the user picked (Rewards always stays).
    for (const cat of [...store.categories]) {
      if (cat.isRewards) continue;
      const wanted = areas.some((a) => areaCategory(a) === cat.name);
      if (!wanted) store.deleteCategory(cat.id);
    }

    // 2. Inside the kept categories, keep only the chosen goals.
    for (const cat of useGoalsStore.getState().categories) {
      if (cat.isRewards) continue;
      const wanted = goals
        .map(goalById)
        .filter((g) => g && areaCategory(g.area) === cat.name);
      const wantedLabels = wanted.map((g) => g.label);

      for (let i = (cat.actions || []).length - 1; i >= 0; i -= 1) {
        if (!wantedLabels.includes(cat.actions[i].label)) store.deleteAction(cat.id, i);
      }
      for (let i = (cat.results || []).length - 1; i >= 0; i -= 1) {
        if (!wantedLabels.includes(cat.results[i].label)) store.deleteResult(cat.id, i);
      }

      // 3. Add the ones this month does not have yet, and set the numbers.
      const fresh = useGoalsStore.getState().categories.find((c) => c.id === cat.id);
      if (!fresh) continue;
      for (const g of wanted) {
        const target = Number(targets[g.id] ?? g.target) || g.target;
        const list = g.kind === "action" ? fresh.actions || [] : fresh.results || [];
        const idx = list.findIndex((x) => x.label === g.label);
        if (idx >= 0) {
          if (g.kind === "action") store.updateAction(fresh.id, idx, "target", target);
          else store.updateResult(fresh.id, idx, "target", target);
        } else if (g.kind === "action") {
          store.addAction(fresh.id, { label: g.label, target, unit: g.unit, weight: 50 });
        } else {
          store.addResult(fresh.id, { label: g.label, target, unit: g.unit, weight: 50 });
        }
      }
    }
  };

  const next = () => {
    if (!valid) return;
    if (step < 7) {
      setOnboarding({ step: step + 1 });
      return;
    }
    setBusy(true);
    try {
      applyToTracker();
      setOnboarding({ step: 7, done: true });
      onFinish?.();
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    if (step === 0) return;
    setOnboarding({ step: step - 1 });
  };

  const chosenGoals = (onboarding.goals || []).map(goalById).filter(Boolean);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--color-base)" }}>
      <div aria-hidden className="bg-anim">
        <div className="bg-orb orb-mint" />
        <div className="bg-orb orb-periwinkle" />
      </div>

      <div className="relative w-full max-w-[560px]">
        <div className="flex justify-center mb-5">
          <Brand size="md" />
        </div>

        <div className="card p-6">
          {/* Segmented progress */}
          <div className="flex gap-1 mb-4" role="progressbar" aria-valuemin={1} aria-valuemax={8} aria-valuenow={step + 1}>
            {Array.from({ length: 8 }, (_, i) => (
              <span
                key={i}
                className="step-seg h-1.5 grow rounded-full"
                style={{
                  background: i <= step ? "var(--color-accent)" : "var(--color-sunken)",
                  boxShadow: i <= step ? "0 0 10px rgba(109,245,227,0.45)" : "none",
                }}
              />
            ))}
          </div>

          <p className="caption" style={{ color: "var(--color-accent)" }}>
            STEP {step + 1} OF 8
          </p>
          <h1 className="h2 text-heading mt-2" style={{ fontSize: 19 }}>
            {step === 0 && `Welcome, ${firstName}. What do you want to improve?`}
            {step === 1 && "How often will you log progress?"}
            {step === 2 && "What's your status?"}
            {step === 3 && "Your country and currency"}
            {step === 4 && "Your phone number"}
            {step === 5 && "Where did you hear about us?"}
            {step === 6 && "Pick your goals"}
            {step === 7 && "Set your numbers"}
          </h1>
          <p className="text-sm text-muted mt-1.5 mb-5">
            {step === 0 && "Pick one or more. You can change everything later."}
            {step === 1 && "This sets the rhythm of your reminders. Change it whenever."}
            {step === 2 && "One answer. It only shapes the advice you get."}
            {step === 3 && "We picked them from your device. Money goals use this currency."}
            {step === 4 && "For your account, so we can reach you if we need to."}
            {step === 5 && "Pick one."}
            {step === 6 && `Choose the ones you want for ${monthLabel}. You can add your own later.`}
            {step === 7 && `Your targets for ${monthLabel}. Change any number.`}
          </p>

          <div className="min-h-[240px]">
            {/* Step 1 — areas */}
            {step === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AREAS.map((a) => {
                  const on = (onboarding.areas || []).includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setOnboarding({ areas: toggle(onboarding.areas || [], a.id) })}
                      aria-pressed={on}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm cursor-pointer transition-colors"
                      style={{
                        background: on ? "var(--color-accent-muted)" : "var(--color-sunken)",
                        border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                        color: on ? "var(--color-accent)" : "var(--color-text-secondary)",
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full grid place-items-center shrink-0"
                        style={{ border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-active)"}` }}
                      >
                        {on ? (
                          <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-accent)" }} />
                        ) : null}
                      </span>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Step 2 — cadence */}
            {step === 1 ? (
              <div className="flex flex-col gap-2">
                {CADENCES.map((c) => {
                  const on = onboarding.cadence === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setOnboarding({ cadence: c.id })}
                      aria-pressed={on}
                      className="px-3 py-3 rounded-lg text-left cursor-pointer transition-colors"
                      style={{
                        background: on ? "var(--color-accent-muted)" : "var(--color-sunken)",
                        border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                      }}
                    >
                      <div className="text-sm font-semibold" style={{ color: on ? "var(--color-accent)" : "var(--color-text-primary)" }}>
                        {c.label}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">{c.hint}</div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Step 3 — status */}
            {step === 2 ? (
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => {
                  const on = onboarding.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setOnboarding({ status: s })}
                      aria-pressed={on}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                      style={{
                        background: on ? "var(--color-accent-muted)" : "var(--color-sunken)",
                        border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                        color: on ? "var(--color-accent)" : "var(--color-text-secondary)",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Step 4 — country + currency */}
            {step === 3 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="caption text-text-tertiary">Country</span>
                  <Select
                    value={onboarding.country || ""}
                    onChange={(v) => {
                      const c = COUNTRIES.find((x) => x.code === v);
                      setOnboarding({ country: v, currency: c?.currency || onboarding.currency });
                    }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="caption text-text-tertiary">Currency</span>
                  <Select value={onboarding.currency || "USD"} onChange={(v) => setOnboarding({ currency: v })}>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            ) : null}

            {/* Step 5 — phone */}
            {step === 4 ? (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="w-[130px] shrink-0">
                    <Select
                      value={onboarding.country || "OTHER"}
                      onChange={(v) => {
                        const c = COUNTRIES.find((x) => x.code === v);
                        setOnboarding({ country: v, currency: c?.currency || onboarding.currency });
                      }}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.calling} {c.code}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grow">
                    <Input
                      value={onboarding.phone || ""}
                      onChange={(v) => setOnboarding({ phone: v })}
                      placeholder="6 00 00 00 00"
                      inputMode="tel"
                    />
                  </div>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!onboarding.whatsapp}
                    onChange={(e) => setOnboarding({ whatsapp: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-[var(--color-accent)]"
                  />
                  <span className="text-sm text-muted">OK to get reminders and tips on WhatsApp</span>
                </label>
              </div>
            ) : null}

            {/* Step 6 — heard from */}
            {step === 5 ? (
              <div className="flex flex-col gap-2">
                {HEARD_FROM.map((h) => {
                  const on = onboarding.heardFrom === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setOnboarding({ heardFrom: h })}
                      aria-pressed={on}
                      className="px-3 py-2.5 rounded-lg text-left text-sm cursor-pointer transition-colors"
                      style={{
                        background: on ? "var(--color-accent-muted)" : "var(--color-sunken)",
                        border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                        color: on ? "var(--color-accent)" : "var(--color-text-secondary)",
                      }}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Step 7 — goals */}
            {step === 6 ? (
              <div className="flex flex-col gap-5">
                {[
                  { kind: "action", title: "Actions", sub: "what you do, scored" },
                  { kind: "result", title: "Results", sub: "what you get, tracked, not scored" },
                ].map((group) => (
                  <div key={group.kind}>
                    <p className="caption text-text-tertiary">{group.title} — {group.sub}</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {GOALS.filter((g) => g.kind === group.kind).map((g) => {
                        const on = (onboarding.goals || []).includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setOnboarding({ goals: toggle(onboarding.goals || [], g.id) })}
                            aria-pressed={on}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left cursor-pointer transition-colors"
                            style={{
                              background: on ? "var(--color-accent-muted)" : "transparent",
                              border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                            }}
                          >
                            <span
                              className="w-4 h-4 rounded-full grid place-items-center shrink-0"
                              style={{ border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-active)"}` }}
                            >
                              {on ? <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-accent)" }} /> : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm text-heading">{g.label}</span>
                              <span className="block text-[11px] text-text-tertiary">
                                {areaLabel(g.area)} — {g.target}
                                {g.unit ? ` ${g.unit}` : ""} per month
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Step 8 — numbers */}
            {step === 7 ? (
              <div className="flex flex-col gap-2">
                {chosenGoals.map((g) => {
                  const value = onboarding.targets?.[g.id] ?? g.target;
                  const money = g.id === "earned" || g.id === "saved" || g.id === "revenue";
                  return (
                    <div
                      key={g.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                      style={{ background: "var(--color-sunken)", border: "1px solid var(--color-border-subtle)" }}
                    >
                      <div className="min-w-0 grow">
                        <p className="text-sm text-heading truncate">{g.label}</p>
                        <p className="text-[11px] text-text-tertiary">
                          {areaLabel(g.area)} · {g.kind === "action" ? "Action" : "Result"}
                        </p>
                      </div>
                      <div className="w-[120px] shrink-0 relative">
                        <Input
                          type="number"
                          min="0"
                          value={value}
                          onChange={(v) =>
                            setOnboarding({ targets: { ...(onboarding.targets || {}), [g.id]: v } })
                          }
                          className="text-right pr-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary pointer-events-none">
                          {money ? currencyOf(onboarding.currency || "USD").symbol : g.unit || ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 mt-6">
            <Btn variant="secondary" onClick={back} disabled={step === 0}>
              Back
            </Btn>
            <div className="grow" />
            <Btn onClick={next} disabled={!valid} busy={busy}>
              {step === 7 ? "Start tracking" : "Continue"}
            </Btn>
          </div>

          <button
            type="button"
            onClick={logout}
            className="mt-4 self-start text-[11px] text-text-tertiary hover:text-muted underline-offset-4 hover:underline cursor-pointer transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </main>
  );
}
