import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "august-goals-pomodoro";

const SF =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif";

// Apple-ish notification sounds, synthesized with the Web Audio API.
const SOUNDS = [
  { id: "tritone", name: "Tri-Tone", play: triTone },
  { id: "chime", name: "Chime", play: chime },
  { id: "dingdong", name: "Ding-Dong", play: dingDong },
  { id: "calypso", name: "Calypso", play: calypso },
  { id: "beep", name: "Beep", play: beep },
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return null;
    return {
      workM: Number(s.workM) || 25,
      breakM: Number(s.breakM) || 5,
      soundId: SOUNDS.some((x) => x.id === s.soundId) ? s.soundId : "tritone",
      phase: s.phase === "break" ? "break" : "work",
      pomodoros: Number(s.pomodoros) || 0,
    };
  } catch {
    return null;
  }
}

export default function Pomodoro() {
  const state0 = useRef(loadState());
  const s = state0.current || { workM: 25, breakM: 5, soundId: "tritone", phase: "work", pomodoros: 0 };

  const [open, setOpen] = useState(false);
  const [workM, setWorkM] = useState(s.workM);
  const [breakM, setBreakM] = useState(s.breakM);
  const [soundId, setSoundId] = useState(s.soundId);
  const [phase, setPhase] = useState(s.phase);
  const [pomodoros, setPomodoros] = useState(s.pomodoros);
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const [notif, setNotif] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ workM, breakM, soundId, phase, pomodoros })
    );
  }, [workM, breakM, soundId, phase, pomodoros]);

  const durMs = (phase === "work" ? workM : breakM) * 60 * 1000;
  const remaining = running && endAt ? Math.max(0, endAt - now) : durMs;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const start = (muted = false) => {
    setFinished(false);
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
    setEndAt(Date.now() + (phase === "work" ? workM : breakM) * 60000);
    setNow(Date.now());
    setRunning(true);
    if (muted) setNotif((n) => n);
  };

  const stop = () => {
    setRunning(false);
    setEndAt(null);
  };

  const skip = () => {
    advance(true);
  };

  const advance = (silent) => {
    const nextPhase = phase === "work" ? "break" : "work";
    if (phase === "work" && !silent) setPomodoros((p) => p + 1);
    setPhase(nextPhase);
    setFinished(true);
    setRunning(false);
    setEndAt(null);
  };

  // When the timer hits zero: fire the alerts.
  useEffect(() => {
    if (!running || !endAt) return;
    if (endAt - now > 40) return;
    setRunning(false);
    const sound = SOUNDS.find((x) => x.id === soundId) || SOUNDS[0];
    sound.play();
    pushNotification();
    advance(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, endAt, running]);

  const fireRaw = (id) => {
    const sound = SOUNDS.find((x) => x.id === id) || SOUNDS[0];
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
    sound.play();
  };

  const toggleNotif = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
    setNotif(Notification.permission === "granted");
  };

  const pushNotification = () => {
    if (!notif && Notification.permission !== "granted") {
      setNotif(true);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then((p) => setNotif(p === "granted"));
      }
    }
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(phase === "work" ? "Deep work done" : "Rest over", {
          body: phase === "work" ? "Time to rest — 5 minutes." : "Back to deep work!",
        });
      } catch {
        /* surface without a real notification is fine */
      }
    }
  };

  const total = durMs;
  const elapsed = total - remaining;
  const R = 96;
  const C = 2 * Math.PI * R;
  const frac = running || finished ? elapsed / total : 0;
  const ringColor = phase === "work" ? "#FF9F0A" : "#30D158";
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm"
          style={{
            background: "#FF9F0A",
            color: "#1D1D1F",
            border: "1px solid rgba(255,255,255,0.28)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
            fontFamily: SF,
          }}
          aria-label="Open pomodoro timer"
          title="Pomodoro timer"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" />
          </svg>
          Focus
          {pomodoros > 0 && (
            <span
              className="grid place-items-center min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold tabular-nums"
              style={{ background: "rgba(29,29,31,0.16)", color: "#1D1D1F" }}
            >
              {pomodoros}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          className="notes-backdrop-in fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,20,25,0.45)", backdropFilter: "blur(12px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="notes-pop w-full max-w-[360px] rounded-[22px] overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #FBFBFD, #F2F2F6)",
              border: "1px solid rgba(0,0,0,0.12)",
              boxShadow: "0 30px 70px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.35)",
              fontFamily: SF,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* macOS title bar with traffic lights */}
            <div className="relative flex items-center justify-between px-4 pt-3 pb-1" style={{ background: "rgba(255,255,255,0.35)" }}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: "#FF5F57" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#FEBC2E" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#28C840" }} />
              </div>
              <span className="text-[13px] font-semibold" style={{ color: "#3A3A3C" }}>
                Focus Timer
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-6 h-6 grid place-items-center rounded-full cursor-pointer"
                style={{ color: "#6E6E73", background: "rgba(0,0,0,0.05)" }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* Finished banner */}
            {finished && (
              <div className="mx-4 mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold"
                style={{ background: phase === "work" ? "#E8F5E9" : "#FFF4E0", color: phase === "work" ? "#1B7A33" : "#9A5B00" }}>
                <span>
                  {phase === "work" ? "Rest over — back to deep work." : "Deep work done — time to rest."}
                </span>
                <button
                  onClick={() => setFinished(false)}
                  className="font-bold underline cursor-pointer"
                  aria-label="Dismiss"
                >
                  OK
                </button>
              </div>
            )}

            {/* Phase + ring + time */}
            <div className="flex flex-col items-center pt-2 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-6 px-3 rounded-full text-[12px] font-semibold grid place-items-center"
                  style={{ background: phase === "work" ? "#FFF0D8" : "#E4F7E8", color: ringColor }}>
                  {phase === "work" ? "Deep Work" : "Rest"}
                </span>
              </div>

              <div className="relative grid place-items-center" style={{ width: 210, height: 210 }}>
                <svg width="210" height="210" viewBox="0 0 210 210" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="105" cy="105" r={R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="11" />
                  <circle
                    cx="105" cy="105" r={R} fill="none"
                    stroke={ringColor}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={running || finished ? C * (1 - frac) : C}
                    style={{ transition: "stroke-dashoffset 0.3s linear" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span className="text-[54px] font-semibold leading-none" style={{ color: "#1D1D1F", letterSpacing: "-0.02em" }}>
                    {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[12px] font-medium" style={{ color: "#86868B" }}>
                    {running ? (phase === "work" ? "stay deep" : "recharge") : finished ? "done" : (phase === "work" ? "ready when you are" : "breathe")}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2.5 mt-1">
                <button
                  onClick={running ? stop : () => start()}
                  className="h-10 px-5 rounded-full font-semibold text-[14px] cursor-pointer"
                  style={{ background: running ? "#3A3A3C" : "#007AFF", color: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.18)" }}
                >
                  {running ? "Pause" : "Start"}
                </button>
                <button
                  onClick={skip}
                  disabled={!running && !finished}
                  className="h-10 px-4 rounded-full font-semibold text-[14px] cursor-pointer disabled:opacity-40"
                  style={{ background: "rgba(0,0,0,0.06)", color: "#3A3A3C" }}
                  title="Skip to next phase"
                >
                  Skip
                </button>
                <button
                  onClick={() => { stop(); setFinished(false); }}
                  className="h-10 w-10 grid place-items-center rounded-full cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.06)", color: "#3A3A3C" }}
                  aria-label="Reset"
                  title="Reset"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Browser alerts toggle */}
            <div className="flex items-center justify-between px-5 pb-1">
              <span className="text-[12px] font-medium" style={{ color: "#6E6E73" }}>
                Desktop alerts
              </span>
              <button
                onClick={toggleNotif}
                role="switch"
                aria-checked={notif}
                className="relative w-9 h-6 rounded-full transition-colors cursor-pointer"
                style={{ background: notif ? "#34C759" : "rgba(0,0,0,0.15)" }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
                  style={{ left: notif ? 14 : 2, transition: "left 0.18s ease" }}
                />
              </button>
            </div>

            {/* Durations */}
            <div className="flex items-center gap-4 px-5 py-2">
              {[
                { label: "Work", val: workM, set: setWorkM, color: "#FF9F0A" },
                { label: "Rest", val: breakM, set: setBreakM, color: "#30D158" },
              ].map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: d.color }}>
                    {d.label}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => d.set(Math.max(1, d.val - 1))}
                      className="w-7 h-7 rounded-full grid place-items-center font-bold text-[15px] cursor-pointer"
                      style={{ background: "rgba(0,0,0,0.06)", color: "#3A3A3C" }}
                      aria-label={`Decrease ${d.label}`}
                    >
                      −
                    </button>
                    <span className="text-[15px] font-semibold tabular-nums w-8 text-center" style={{ color: "#1D1D1F" }}>
                      {d.val}
                    </span>
                    <button
                      onClick={() => d.set(Math.min(120, d.val + 1))}
                      className="w-7 h-7 rounded-full grid place-items-center font-bold text-[15px] cursor-pointer"
                      style={{ background: "rgba(0,0,0,0.06)", color: "#3A3A3C" }}
                      aria-label={`Increase ${d.label}`}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[10px]" style={{ color: "#6E6E73" }}>min</span>
                </div>
              ))}
              <div className="flex-1 flex flex-col items-center">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8E8E93" }}>
                  Done
                </span>
                <span className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: "#1D1D1F" }}>
                  {pomodoros}
                </span>
                <span className="text-[10px]" style={{ color: "#6E6E73" }}>sessions</span>
              </div>
            </div>

            {/* Sound picker */}
            <div className="px-5 pb-4 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8E8E93" }}>
                When time's up
              </span>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {SOUNDS.map((sd) => (
                  <button
                    key={sd.id}
                    onClick={() => { setSoundId(sd.id); fireRaw(sd.id); }}
                    className="h-7 px-3 rounded-full text-[12px] font-semibold cursor-pointer flex items-center gap-1.5"
                    style={{
                      background: soundId === sd.id ? "#F0F0F4" : "rgba(0,0,0,0.05)",
                      border: soundId === sd.id ? "1px solid rgba(0,0,0,0.18)" : "1px solid transparent",
                      color: soundId === sd.id ? "#1D1D1F" : "#3A3A3C",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3 9v6h4l5 5V4L7 9H3zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {sd.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Web Audio alarm generators ---------- */

let audioCtx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function note(ctx, { freq, time, dur, type = "sine", gain = 0.2 }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function triTone() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  [[880, 0], [740, 0.32], [587, 0.64]].forEach(([f, o], i) => {
    note(ctx, { freq: f, time: t + o, dur: 0.5, gain: 0.16 });
    note(ctx, { freq: f * 2, time: t + o, dur: 0.5, gain: 0.04, type: "sine" });
    if (i === 2) note(ctx, { freq: f, time: t + o + 0.5, dur: 1.2, gain: 0.14 });
  });
}

function chime() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  [[1046, 0], [1318, 0.12], [1568, 0.24]].forEach(([f, o]) => {
    note(ctx, { freq: f, time: t + o, dur: 0.9, gain: 0.1, type: "sine" });
    note(ctx, { freq: f * 2, time: t + o, dur: 0.8, gain: 0.03 });
  });
}

function dingDong() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  note(ctx, { freq: 660, time: t, dur: 1.0, gain: 0.18 });
  note(ctx, { freq: 523, time: t + 0.55, dur: 1.2, gain: 0.16 });
}

function calypso() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  [[784, 0], [659, 0.15], [587, 0.3], [523, 0.45], [587, 0.6], [659, 0.75]].forEach(([f, o]) => {
    note(ctx, { freq: f, time: t + o, dur: 0.35, gain: 0.14, type: "triangle" });
  });
}

function beep() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    note(ctx, { freq: 1200, time: t + i * 0.35, dur: 0.22, gain: 0.15, type: "square" });
  }
}