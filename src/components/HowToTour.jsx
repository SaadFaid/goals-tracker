import { useState } from "react";
import Modal from "./Modal";
import { Btn } from "./ui";

/* ════════════════════════════════════════════════════════════
   The how-to tour. Eight short steps, each with a tiny animated
   demo of the piece of the UI it is talking about.
   ════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    name: "Turn on Edit",
    text: "Tap Edit to add, change or remove goals, then tap Done when you're finished.",
    demo: "edit",
  },
  {
    name: "Add a goal",
    text: "In Edit, tap + Add goal in a category, type a name and tap Add goal.",
    demo: "add",
  },
  {
    name: "Change a goal",
    text: "In Edit, tap the pencil on a goal to change its name or target, then tap Save changes.",
    demo: "pencil",
  },
  {
    name: "Log your progress",
    text: "Hold a goal's bar for a moment, then slide it to log what you did.",
    demo: "bar",
  },
  {
    name: "Tick off a one-time goal",
    text: "Tap the box on a one-time goal when it's done.",
    demo: "check",
  },
  {
    name: "Read the rings and pace",
    text: "The rings show your month, and the pace card says if you're on pace today.",
    demo: "rings",
  },
  {
    name: "Keep your streak",
    text: "Move any goal on a day to grow your streak; three quiet days in a row end it.",
    demo: "flame",
  },
  {
    name: "See the leaderboard",
    text: "Tap Leaderboard to see where your streak ranks among members.",
    demo: "board",
  },
];

/* ── mini demos ────────────────────────────────────────────── */
function DemoFrame({ children }) {
  return (
    <div
      className="rounded-xl p-4 grid place-items-center min-h-[190px]"
      style={{ background: "var(--color-base)", border: "1px solid var(--color-border-subtle)" }}
    >
      {children}
    </div>
  );
}

function Row({ label, value, right, children }) {
  return (
    <div className="flex items-center gap-2 text-[11px] w-full max-w-[300px]">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--color-accent)" }} />
      <span className="text-muted grow truncate">{label}</span>
      {children ?? <span className="mono text-heading">{value}</span>}
      {right}
    </div>
  );
}

function DemoEdit() {
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <span
          className="px-3 h-7 rounded-full text-[11px] font-bold grid place-items-center"
          style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}
        >
          Done
        </span>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-[300px]">
        <Row label="Workout sessions" value="8 / 12" />
        <Row label="Learning hours" value="5 / 20" />
      </div>
    </div>
  );
}

function DemoAdd() {
  return (
    <div className="w-full flex flex-col items-center gap-2.5">
      <div
        className="w-full max-w-[300px] rounded-lg px-3 py-2 text-[11px]"
        style={{ border: "1px dashed var(--color-accent)", color: "var(--color-accent)", background: "var(--color-accent-muted)" }}
      >
        + Add goal to Health &amp; Fitness
      </div>
      <div
        className="w-full max-w-[300px] rounded-lg px-3 py-2 text-[11px] text-text-tertiary"
        style={{ background: "var(--color-sunken)", border: "1px solid var(--color-border-subtle)" }}
      >
        e.g. Workout sessions
      </div>
    </div>
  );
}

function DemoPencil() {
  return (
    <div className="w-full flex flex-col items-center gap-2.5">
      <div
        className="w-full max-w-[300px] rounded-lg px-3 py-2 flex items-center gap-2"
        style={{ background: "var(--color-sunken)", border: "1px solid var(--color-accent)" }}
      >
        <span className="text-[11px] text-heading grow">Workout sessions</span>
        <span className="text-[11px]" style={{ color: "var(--color-accent)" }}>✎</span>
      </div>
      <div
        className="w-full max-w-[300px] rounded-lg px-3 py-2 text-[11px]"
        style={{ background: "var(--color-accent-muted)", border: "1px solid rgba(109,245,227,0.3)", color: "var(--color-accent)" }}
      >
        Save changes
      </div>
    </div>
  );
}

function DemoBar() {
  const [w, setW] = useState(38);
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="w-full max-w-[300px]">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-muted">Workout sessions</span>
          <span className="mono text-heading">8 / 12</span>
        </div>
        <div
          className="h-2 rounded-full relative cursor-pointer"
          style={{ background: "var(--color-sunken)", border: "1px solid var(--color-border-subtle)" }}
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            setW(Math.round(((e.clientX - box.left) / box.width) * 100));
          }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${w}%`, background: "linear-gradient(90deg, rgba(109,245,227,0.35), var(--color-accent))" }}
          />
        </div>
      </div>
      <p className="text-[10px] text-text-tertiary">Tap the bar to move it</p>
    </div>
  );
}

function DemoCheck() {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      className="flex items-center gap-3 cursor-pointer"
      aria-pressed={on}
    >
      <span
        className="w-8 h-8 rounded-full grid place-items-center transition-all"
        style={{
          background: on ? "var(--color-accent)" : "var(--color-sunken)",
          border: `1px solid ${on ? "var(--color-accent)" : "var(--color-border-active)"}`,
          color: "#101010",
          transform: on ? "scale(1.08)" : "scale(1)",
        }}
      >
        {on ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
      <span className="text-[12px]" style={{ color: on ? "var(--color-accent)" : "var(--color-text-secondary)" }}>
        Renew passport
      </span>
    </button>
  );
}

function DemoRings() {
  const rings = [
    { label: "Execution", pct: 0.72, color: "var(--color-accent)" },
    { label: "Money", pct: 0.55, color: "var(--color-gold)" },
    { label: "Results", pct: 0.4, color: "#FFA14D" },
  ];
  return (
    <div className="flex items-center gap-5">
      {rings.map((r) => {
        const size = 56;
        const rad = (size - 8) / 2;
        const c = 2 * Math.PI * rad;
        return (
          <div key={r.label} className="flex flex-col items-center gap-1">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="var(--color-sunken)" strokeWidth="5" />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={rad}
                fill="none"
                stroke={r.color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - r.pct)}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
              />
            </svg>
            <span className="text-[9px] text-text-tertiary">{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DemoFlame() {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-3xl"
        style={{ color: "var(--color-accent)", filter: "drop-shadow(0 0 12px rgba(109,245,227,0.6))" }}
        aria-hidden="true"
      >
        ▲
      </span>
      <div>
        <div className="stat-num" style={{ color: "var(--color-text-primary)", fontSize: 20 }}>
          5-day streak
        </div>
        <div className="text-[10px] text-text-tertiary">move a goal today to keep it</div>
      </div>
    </div>
  );
}

function DemoBoard() {
  const rows = [
    { rank: 1, name: "Sara B.", streak: 12 },
    { rank: 2, name: "Yousef A.", streak: 5 },
    { rank: 3, name: "Nadia T.", streak: 2 },
  ];
  return (
    <div className="w-full max-w-[300px] flex flex-col gap-1.5">
      {rows.map((r) => (
        <div
          key={r.rank}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px]"
          style={{ background: "var(--color-sunken)", border: "1px solid var(--color-border-subtle)" }}
        >
          <span className="mono text-text-tertiary w-4">{r.rank}</span>
          <span className="text-heading grow">{r.name}</span>
          <span style={{ color: "var(--color-accent)" }}>▲ {r.streak}</span>
        </div>
      ))}
    </div>
  );
}

const DEMOS = {
  edit: DemoEdit,
  add: DemoAdd,
  pencil: DemoPencil,
  bar: DemoBar,
  check: DemoCheck,
  rings: DemoRings,
  flame: DemoFlame,
  board: DemoBoard,
};

export default function HowToTour({ open, onClose, onDone }) {
  const [step, setStep] = useState(0);
  const Demo = DEMOS[STEPS[step].demo] || DemoEdit;
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    onDone?.();
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={finish}
      title="How to use Paceline"
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={finish}>
            Skip
          </Btn>
          <div className="grow" />
          <Btn
            onClick={() => {
              if (isLast) finish();
              else setStep((s) => s + 1);
            }}
          >
            {isLast ? "Done" : "Continue"}
          </Btn>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span
          className="grid place-items-center w-7 h-7 rounded-full text-[12px] font-bold"
          style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}
        >
          {step + 1}
        </span>
        <span className="h3 text-heading">{STEPS[step].name}</span>
        <span className="mono text-text-tertiary ml-auto">
          {step + 1} of {STEPS.length}
        </span>
      </div>

      <DemoFrame>
        <Demo />
      </DemoFrame>

      <p className="text-sm text-muted mt-4 leading-relaxed">{STEPS[step].text}</p>
    </Modal>
  );
}
