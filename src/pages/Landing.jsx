import { useEffect, useRef, useState } from "react";
import Brand, { BrandMark } from "../components/Brand";
import CookieBanner from "../components/CookieBanner";
import { Btn } from "../components/ui";
import { BRAND } from "../lib/brand";
import { useGoalsStore } from "../store/useGoalsStore";

/* ════════════════════════════════════════════════════════════
   Landing page — the public face of Paceline.
   Every colour, font, radius and shadow here comes from the
   existing theme tokens in index.css. Nothing new is invented.
   ════════════════════════════════════════════════════════════ */

const go = (hash) => {
  if (typeof window !== "undefined") window.location.hash = hash;
};

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top, behavior: "smooth" });
};

/* ── Scroll reveal ─────────────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll(".reveal"));
    if (!nodes.length) return undefined;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("in"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
}

/* ── Count up ──────────────────────────────────────────────── */
function useCountUp(target, active, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

/* ── Navbar ────────────────────────────────────────────────── */
function LandingNav({ signedIn }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      const ids = ["how-it-works", "features", "faq"];
      let current = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { id: "how-it-works", label: "How it works" },
    { id: "features", label: "Features" },
    { id: "faq", label: "FAQ" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-colors ${scrolled || open ? "nav-blur" : "bg-transparent"}`}
      style={!scrolled && !open ? { borderBottom: "1px solid transparent" } : undefined}
    >
      <div className="mx-auto max-w-[1140px] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="shrink-0"
          aria-label={`${BRAND.name} home`}
        >
          <Brand withMark size="sm" />
        </a>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollToId(l.id)}
              className="nav-btn"
              style={{
                border: "1px solid transparent",
                color: active === l.id ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
              aria-current={active === l.id ? "true" : undefined}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {signedIn ? (
            <Btn onClick={() => go("#/app")}>Open tracker</Btn>
          ) : (
            <>
              <Btn variant="secondary" onClick={() => go("#/login")}>
                Log in
              </Btn>
              <Btn onClick={() => go("#/signup")}>Start tracking</Btn>
            </>
          )}
        </div>

        <button
          className="md:hidden grid place-items-center w-9 h-9 rounded-lg cursor-pointer"
          style={{ border: "1px solid var(--color-border-active)", color: "var(--color-text-primary)" }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="md:hidden px-4 pb-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setOpen(false);
                scrollToId(l.id);
              }}
              className="text-left text-sm py-2"
              style={{ color: active === l.id ? "var(--color-accent)" : "var(--color-text-secondary)" }}
            >
              {l.label}
            </button>
          ))}
          <div className="flex flex-col gap-2 pt-2 mt-1" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
            {signedIn ? (
              <Btn onClick={() => go("#/app")}>Open tracker</Btn>
            ) : (
              <>
                <Btn variant="secondary" onClick={() => go("#/login")}>
                  Log in
                </Btn>
                <Btn onClick={() => go("#/signup")}>Start tracking</Btn>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

/* ── Rings ─────────────────────────────────────────────────── */
function Ring({ label, value, sub, pct, color, size = 84, animate }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="7" />
          <circle
            className={`ring-arc ${animate ? "in" : ""}`}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth="7"
            stroke={color}
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="stat-num" style={{ color: "var(--color-text-primary)", fontSize: 15 }}>
              {value}
            </div>
          </div>
        </div>
      </div>
      <div className="caption" style={{ color: "var(--color-text-secondary)" }}>
        {label}
      </div>
      {sub ? <div className="text-[10px] text-text-tertiary">{sub}</div> : null}
    </div>
  );
}

/* ── Hero mockup ──────────────────────────────────────────── */
function Mockup() {
  const [animate, setAnimate] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) {
      setAnimate(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setAnimate(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Execution line climbs, the "should be" line is the straight dashed one.
  const days = 12;
  const actual = [4, 7, 9, 12, 15, 17, 21, 24, 27, 29, 31, 33];
  const should = Array.from({ length: days }, (_, i) => 2.5 + (i * 31) / (days - 1));
  const max = 36;
  const toXY = (arr) =>
    arr
      .map((v, i) => `${(i / (arr.length - 1)) * 100},${34 - (v / max) * 30}`)
      .join(" ");

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[820px] px-2 sm:px-6">
      <div
        className="float-gentle soft-glow rounded-2xl p-3 sm:p-4"
        style={{ background: "var(--color-elevated)", border: "1px solid var(--color-border-active)" }}
      >
        {/* Laptop */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-base)", border: "1px solid var(--color-border-subtle)" }}>
          <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-border-active)" }} />
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-border-active)" }} />
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-border-active)" }} />
            <span className="ml-2 text-[10px] text-text-tertiary">Paceline</span>
          </div>
          <div className="p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-3 sm:gap-5 justify-center">
              <Ring label="Execution" value="13/18" pct={0.72} color="var(--color-accent)" animate={animate} size={72} />
              <Ring label="Money" value="4,200" pct={0.58} color="var(--color-gold)" animate={animate} size={72} />
              <Ring label="Results" value="3 tracked" pct={0.66} color="#FFA14D" animate={animate} size={72} />
            </div>
            <div className="grow min-w-0">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full" style={{ height: 92 }} aria-label="Progress chart">
                <polyline
                  className={`chart-line ${animate ? "in" : ""}`}
                  points={toXY(actual)}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  className={`chart-dash ${animate ? "in" : ""}`}
                  points={toXY(should)}
                  fill="none"
                  stroke="var(--color-grey)"
                  strokeWidth="1.2"
                  strokeDasharray="3 2.4"
                />
              </svg>
              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-text-tertiary">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block" style={{ width: 14, borderTop: "2px solid var(--color-accent)" }} /> Execution
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block" style={{ width: 14, borderTop: "2px dashed var(--color-grey)" }} /> Should be
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Laptop base */}
        <div
          className="mx-auto h-2.5 rounded-b-2xl"
          style={{ background: "linear-gradient(180deg, var(--color-surface-2), var(--color-sunken))", width: "62%" }}
          aria-hidden="true"
        />
      </div>

      {/* Phone */}
      <div
        className="float-gentle-2 absolute -right-1 sm:right-2 -bottom-10 sm:-bottom-12 w-[150px] rounded-2xl p-2"
        style={{ background: "var(--color-elevated)", border: "1px solid var(--color-border-active)", boxShadow: "0 24px 50px rgba(0,0,0,0.55)" }}
      >
        <div className="rounded-xl p-2" style={{ background: "var(--color-base)", border: "1px solid var(--color-border-subtle)" }}>
          <div className="text-center caption text-text-tertiary mb-1">Day 12 of 31</div>
          <div className="flex justify-center mb-1.5">
            <Ring label="" value="72%" pct={0.72} color="var(--color-accent)" animate={animate} size={54} />
          </div>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full" style={{ height: 42 }} aria-hidden="true">
            <polyline
              className={`chart-line ${animate ? "in" : ""}`}
              points={toXY(actual.slice(0, 9))}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <polyline
              className={`chart-dash ${animate ? "in" : ""}`}
              points={toXY(should.slice(0, 9))}
              fill="none"
              stroke="var(--color-grey)"
              strokeWidth="1.4"
              strokeDasharray="3 2.4"
            />
          </svg>
          <div className="mt-1.5 text-center text-[9px] font-semibold" style={{ color: "var(--color-accent)" }}>
            ON PACE
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sections ──────────────────────────────────────────────── */
function SectionHeading({ eyebrow, title, sub, center = true }) {
  return (
    <div className={center ? "text-center" : ""} style={{ maxWidth: 720, margin: center ? "0 auto" : 0 }}>
      {eyebrow ? (
        <p className="caption text-text-tertiary mb-2" style={{ color: "var(--color-accent)" }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className="h2 text-heading" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      {sub ? <p className="text-sm text-muted mt-2 leading-relaxed">{sub}</p> : null}
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Set this month's goals",
    body: "Pick a handful of things you actually want done this month, give each one a target, and move on with your day.",
  },
  {
    n: "02",
    title: "Log progress every day",
    body: "Open the tracker, tap a goal, and say what you did. A checklist at the end of the day takes ten seconds.",
  },
  {
    n: "03",
    title: "See where you stand",
    body: "The rings, the pace line and the streak tell you whether the month is on track — and what to fix tomorrow.",
  },
];

const FEATURES = [
  {
    title: "A month, not a to-do list",
    body: "Goals reset when the month turns. You are not fighting yesterday's list every morning.",
  },
  {
    title: "Execution, Money and Results",
    body: "What you do, what you earn, what you get. Only the first one scores — the rest are tracked, not judged.",
  },
  {
    title: "The pace line",
    body: "A dashed line shows where the month should be today. You always know if you are ahead or behind.",
  },
  {
    title: "Streaks that mean something",
    body: "Move any goal on a day to keep the flame alive. Three quiet days in a row and it ends — no fake wins.",
  },
  {
    title: "A checklist that remembers",
    body: "Every day is saved with what you typed and what you ticked, so you can look back at any day of the month.",
  },
  {
    title: "Private by default",
    body: "Only you see your goals. The leaderboard shows your first name, your last initial and your streak.",
  },
];

const FAQS = [
  {
    q: "How much does it cost?",
    a: "Nothing. Paceline is free while it is in early access — no card, no trial clock, no downgrade at the end of the month. If that ever changes, you will hear it from me directly before anything is charged.",
  },
  {
    q: "Is Paceline an app or a website?",
    a: "A website that works just as well on your phone as on your laptop. Open the link, add it to your home screen if you want, and there is nothing to download.",
  },
  {
    q: "What are Execution, Money and Results?",
    a: "Execution is what you do — sessions, hours, no-spend days. That is your score. Money is what you earn or save, tracked in your own currency. Results are what you get out of it, like weight or revenue: tracked, but never scored.",
  },
  {
    q: "What does “on pace” mean?",
    a: "It means your progress so far this month is at least where a straight line from zero to your target would put you on today's date. Ahead of that line means ahead of schedule.",
  },
  {
    q: "How does the streak work?",
    a: "Move any goal on a day and the flame grows. Miss three days in a row and the streak ends, so it only stays alive while you actually keep moving.",
  },
  {
    q: "Who can see my goals?",
    a: "Nobody. Your goal names, your numbers and your notes are private to you. On the leaderboard other members see your first name, your last initial and your streak — that is all.",
  },
  {
    q: "How do you spell Paceline?",
    a: "P-A-C-E-L-I-N-E. Like the cyclist sitting at the front of the line, setting the pace for everyone else.",
  },
  {
    q: "How do I get help?",
    a: `Email ${BRAND.supportEmail}. A real person reads it. If something in the tracker looks broken, that is the fastest way to get it fixed.`,
  },
  {
    q: "Do I need a card to sign up?",
    a: "No. There is nothing to buy, so there is no card field anywhere in the app. Sign up with an email and start setting goals.",
  },
];

const TIMELINE = [
  {
    when: "The problem",
    what: "Every month started the same way: a fresh page, twelve goals, and no idea by the 20th whether the month was going well or just felt busy.",
  },
  {
    when: "The spreadsheet",
    what: "I built a weighted monthly sheet for myself — what I do counts, what I earn is tracked, what I get is remembered. It worked, and it was ugly.",
  },
  {
    when: "Today",
    what: `${BRAND.name} is that sheet with a proper interface: same rules, one month at a time, open to anyone who wants a month that adds up.`,
  },
];

/* ── Pace chart card ───────────────────────────────────────── */
function PaceCard() {
  const [animate, setAnimate] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setAnimate(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setAnimate(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const actual = [6, 9, 14, 16, 21, 23, 28, 30, 33, 35, 37, 39];
  const should = Array.from({ length: 12 }, (_, i) => 3 + (i * 36) / 11);
  const max = 42;
  const toXY = (arr) =>
    arr.map((v, i) => `${(i / (arr.length - 1)) * 100},${38 - (v / max) * 34}`).join(" ");

  return (
    <div ref={ref} className="card p-5 sm:p-6" style={{ overflow: "hidden" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="caption text-text-tertiary">Day 12 of 31</p>
          <p className="h3 text-heading mt-1">39% done — should be 39%</p>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
        >
          ON PACE
        </span>
      </div>
      <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="w-full" style={{ height: 170 }} role="img" aria-label="Execution against the should-be pace line">
        <polyline
          className={`chart-line ${animate ? "in" : ""}`}
          points={toXY(actual)}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          className={`chart-dash ${animate ? "in" : ""}`}
          points={toXY(should)}
          fill="none"
          stroke="var(--color-grey)"
          strokeWidth="1.3"
          strokeDasharray="3.5 2.6"
        />
      </svg>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 16, borderTop: "2px solid var(--color-accent)" }} /> Execution
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block" style={{ width: 16, borderTop: "2px solid var(--color-grey)" }} /> Should be
        </span>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function Landing() {
  const user = useGoalsStore((s) => s.user);
  const isGuest = useGoalsStore((s) => s.isGuest);
  const signedIn = !!user && !isGuest;
  const [openFaq, setOpenFaq] = useState(0);
  const [heroCount, setHeroCount] = useState(0);
  const heroRef = useRef(null);

  useReveal();

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setHeroCount(1);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const days = useCountUp(18, heroCount === 1);
  const pace = useCountUp(72, heroCount === 1);

  return (
    <div id="top" className="min-h-screen" style={{ background: "var(--color-base)" }}>
      <div aria-hidden className="bg-anim">
        <div className="bg-orb orb-mint" />
        <div className="bg-orb orb-periwinkle" />
        <div className="bg-orb orb-coral" />
        <div className="bg-sheen" />
      </div>

      <LandingNav signedIn={signedIn} />

      {/* ── Hero ── */}
      <section className="relative px-4 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24">
        <div className="mx-auto max-w-[1140px] grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          <div>
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide"
              style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)", border: "1px solid rgba(109,245,227,0.25)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-accent)" }} />
              {BRAND.label}
            </span>

            <h1 className="mt-4 leading-[1.05]" style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-primary)" }}>
              <span style={{ display: "block", fontSize: "clamp(2.1rem, 6vw, 3.4rem)" }}>Set goals.</span>
              <span className="gradient-text" style={{ display: "block", fontSize: "clamp(2.1rem, 6vw, 3.4rem)" }}>
                Stay on pace.
              </span>
            </h1>

            <p className="mt-5 text-[15px] leading-relaxed text-muted max-w-lg">
              Paceline turns a month into a handful of targets you can actually hit. Set them, log what you did, and see every day whether you are keeping up.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Btn size="lg" className="press-btn hover-arrow" onClick={() => go("#/signup")}>
                Start tracking
                <svg className="arrow-slide" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Btn>
              <Btn size="lg" variant="secondary" onClick={() => scrollToId("how-it-works")}>
                See how it works
              </Btn>
            </div>

            <p className="mt-6 text-[12px] text-text-tertiary flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Free while in early access</span>
              <span aria-hidden="true">·</span>
              <span>Nothing to install</span>
              <span aria-hidden="true">·</span>
              <span>Laptop and phone</span>
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
              {[
                { v: days, suffix: "", label: "actions this month" },
                { v: pace, suffix: "%", label: "of the way there" },
                { v: 5, suffix: "-day", label: "streak, and counting" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl px-3 py-2.5" style={{ background: "var(--color-elevated)", border: "1px solid var(--color-border-subtle)" }}>
                  <div className="stat-num" style={{ color: "var(--color-accent)", fontSize: 20 }}>
                    {s.v}
                    {s.suffix}
                  </div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div ref={heroRef}>
            <Mockup />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20">
        <div className="mx-auto max-w-[1140px]">
          <div className="reveal">
            <SectionHeading eyebrow="How it works" title="Three steps, once a month" sub="Set the targets, tick them off as you go, and read the month at the end of it." />
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <article
                key={s.n}
                className="card card-lift reveal p-6"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <span className="stat-num" style={{ color: "var(--color-accent)", fontSize: 22 }}>
                  {s.n}
                </span>
                <h3 className="h3 text-heading mt-3" style={{ fontSize: 15 }}>
                  {s.title}
                </h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── The pace line ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div className="mx-auto max-w-[1140px] grid lg:grid-cols-2 gap-10 items-center">
          <div className="reveal">
            <SectionHeading
              center={false}
              eyebrow="The pace line"
              title="You are not behind. You are just early."
              sub="Every month has a straight line from zero to your target. The dashed line on the chart is where today sits on it. Stay above it and the month is yours."
            />
            <ul className="mt-6 flex flex-col gap-3">
              {[
                "The dashed line is the month, not you — it never moves.",
                "Your solid line is your progress, day by day.",
                "Above the line reads AHEAD. Below it reads BEHIND. On it reads ON PACE.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-muted">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--color-accent)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal" style={{ transitionDelay: "80ms" }}>
            <PaceCard />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div className="mx-auto max-w-[1140px]">
          <div className="reveal">
            <SectionHeading eyebrow="Features" title="What you get" sub="Everything in the tracker, and nothing you have to install." />
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <article
                key={f.title}
                className="card card-lift reveal p-5"
                style={{ transitionDelay: `${(i % 3) * 80}ms` }}
              >
                <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h3 className="h3 text-heading mt-3" style={{ fontSize: 15 }}>
                  {f.title}
                </h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="px-4 sm:px-6 py-16 sm:py-20 scroll-mt-20" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div className="mx-auto max-w-[820px]">
          <div className="reveal">
            <SectionHeading eyebrow="FAQ" title="Questions, answered straight" sub="If the answer you want is not here, email us and we will add it." />
          </div>
          <div className="mt-10 flex flex-col gap-2.5">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={f.q}
                  className={`card reveal overflow-hidden transition-colors ${open ? "" : "hover:border-[var(--color-border-active)]"}`}
                  style={{ transitionDelay: `${(i % 4) * 60}ms` }}
                >
                  <button
                    className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left cursor-pointer"
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-button-${i}`}
                  >
                    <span className="text-sm font-semibold text-heading">{f.q}</span>
                    <span
                      className="grid place-items-center w-6 h-6 rounded-full shrink-0 transition-transform"
                      style={{
                        background: open ? "var(--color-accent-muted)" : "var(--color-sunken)",
                        color: open ? "var(--color-accent)" : "var(--color-text-tertiary)",
                        border: "1px solid var(--color-border-subtle)",
                        transform: open ? "rotate(45deg)" : "none",
                      }}
                      aria-hidden="true"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                  <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-button-${i}`} className={`faq-body ${open ? "open" : ""}`}>
                    <div>
                      <p className="px-4 sm:px-5 pb-4 text-sm text-muted leading-relaxed">{f.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Founder ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div className="mx-auto max-w-[1000px] grid md:grid-cols-[1fr_1.1fr] gap-10 items-start">
          <div className="reveal">
            <BrandMark size={22} />
            <h2 className="h2 text-heading mt-4" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
              Built by {BRAND.founder}
            </h2>
            <p className="text-sm text-muted mt-3 leading-relaxed">
              I am {BRAND.founder}. I kept rebuilding the same spreadsheet every month, and every version
              had the same flaw: it told me what I had done, never whether I was on pace. So I built the
              thing I wanted to open each morning.
            </p>
            <p className="text-sm text-muted mt-3 leading-relaxed">
              {BRAND.name} is deliberately small. One month, a handful of goals, a score you cannot
              flatter, and a line that says ahead or behind without asking how you feel about it.
              No streaks bought with easy wins, no dashboard full of numbers that never change a decision.
            </p>
            <p className="text-sm text-muted mt-3 leading-relaxed">
              It is free while it is in early access. I read every reply that reaches{" "}
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="underline-offset-4 hover:underline"
                style={{ color: "var(--color-accent)" }}
              >
                {BRAND.supportEmail}
              </a>
              .
            </p>
          </div>
          <div className="reveal" style={{ transitionDelay: "80ms" }}>
            <ol className="flex flex-col gap-0">
              {TIMELINE.map((t, i) => (
                <li key={t.when} className="flex gap-4 pb-6 relative">
                  <div className="flex flex-col items-center shrink-0">
                    <span
                      className="w-3 h-3 rounded-full mt-1.5"
                      style={{ background: "var(--color-accent)", boxShadow: "0 0 12px rgba(109,245,227,0.5)" }}
                    />
                    {i < TIMELINE.length - 1 ? (
                      <span className="grow w-px mt-1" style={{ background: "var(--color-border-active)" }} />
                    ) : null}
                  </div>
                  <div className="pb-1">
                    <p className="caption" style={{ color: "var(--color-accent)" }}>
                      {t.when}
                    </p>
                    <p className="text-sm text-muted mt-1 leading-relaxed">{t.what}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-24" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div className="mx-auto max-w-[700px] text-center reveal">
          <h2 className="h2 text-heading" style={{ fontSize: 28, letterSpacing: "-0.02em" }}>
            Start tracking this month.
          </h2>
          <p className="text-sm text-muted mt-3 max-w-md mx-auto">
            Free while it is in early access, and nothing to install. Set three goals and see where the month takes you.
          </p>
          <div className="mt-7 flex justify-center">
            <Btn size="lg" className="press-btn hover-arrow" onClick={() => go("#/signup")}>
              Start tracking
              <svg className="arrow-slide" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Btn>
          </div>
        </div>
      </section>

      <LandingFooter />
      <CookieBanner />
    </div>
  );
}

/* ── Footer ────────────────────────────────────────────────── */
export function LandingFooter() {
  return (
    <footer className="px-4 sm:px-6 py-10" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
      <div className="mx-auto max-w-[1140px] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Brand size="sm" />
          <span className="text-[12px] text-text-tertiary">· © {BRAND.year}</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Legal">
          {["privacy", "terms", "refunds", "cookies"].map((id) => (
            <button
              key={id}
              onClick={() => go(`#/legal/${id}`)}
              className="text-[12px] text-text-tertiary hover:text-heading transition-colors cursor-pointer capitalize"
            >
              {id}
            </button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
