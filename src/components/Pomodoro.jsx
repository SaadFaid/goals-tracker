import { useEffect, useRef, useState } from "react";
import FlipClock from "./FlipClock";

const STORAGE_KEY = "august-goals-pomodoro";
const ALERT_KEY = "august-goals-alerts";
const REPEAT_MS = 10_000;

const SF =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif";

// Notification sounds, synthesized with the Web Audio API.
const SOUNDS = [
  { id: "tritone", name: "Tri-Tone", play: triTone },
  { id: "chime", name: "Chime", play: chime },
  { id: "dingdong", name: "Ding-Dong", play: dingDong },
  { id: "calypso", name: "Calypso", play: calypso },
  { id: "beep", name: "Beep", play: beep },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadState() {
  const s = readJson(STORAGE_KEY, null);
  const base = { workM: 25, breakM: 5, soundId: "tritone", phase: "work", pomodoros: 0, repeat: true, mode: "focus", tH: 0, tM: 10, tS: 0, tRunning: false, tEndAt: null };
  if (!s || typeof s !== "object") return base;
  const tEndNow = Date.now();
  return {
    workM: Number(s.workM) || base.workM,
    breakM: Number(s.breakM) || base.breakM,
    soundId: SOUNDS.some((x) => x.id === s.soundId) ? s.soundId : base.soundId,
    phase: s.phase === "break" ? "break" : "work",
    pomodoros: Number(s.pomodoros) || 0,
    repeat: s.repeat !== false,
    mode: s.mode === "timer" ? "timer" : "focus",
    tH: Math.max(0, Math.min(99, Number(s.tH) || 0)),
    tM: Math.max(0, Math.min(59, Number(s.tM) || 0)),
    tS: Math.max(0, Math.min(59, Number(s.tS) || 0)),
    // Keep a running plain timer alive across a refresh: restore the absolute
    // end timestamp only if it is still in the future.
    tRunning: !!s.tRunning,
    tEndAt: !!s.tRunning && Number(s.tEndAt) > tEndNow ? Number(s.tEndAt) : null,
    // A paused plain timer keeps its remaining time across a refresh: without
    // this, Stop then reload snaps back to the full duration.
    tHold: Math.max(0, Number(s.tHold) || 0),
  };
}

function fmtClock(ms, withHours = false) {
  ms = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(ms / 3600);
  const m = Math.floor((ms % 3600) / 60);
  const s = ms % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function endClock(endAt) {
  if (!endAt) return "";
  const d = new Date(endAt);
  const h = d.getHours();
  const m = d.getMinutes();
  return `Ends at ${pad2(h)}:${pad2(m)}`;
}

export default function Pomodoro() {
  const boot = useRef(loadState());
  const s = boot.current;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(s.mode);
  const [workM, setWorkM] = useState(s.workM);
  const [breakM, setBreakM] = useState(s.breakM);
  const [soundId, setSoundId] = useState(soundIdFrom(s));
  const [phase, setPhase] = useState(s.phase);
  const [pomodoros, setPomodoros] = useState(s.pomodoros);
  const [repeat, setRepeat] = useState(s.repeat);
  const [notif, setNotif] = useState(hasNotifPerm());

  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  // Remaining focus time preserved while paused (so pause/resume keeps progress).
  const [hold, setHold] = useState(0);

  // Plain timer (black clock).
  const [tH, setTH] = useState(s.tH);
  const [tM, setTM] = useState(s.tM);
  const [tS, setTS] = useState(s.tS);
  const [tRunning, setTRunning] = useState(s.tRunning);
  const [tEndAt, setTEndAt] = useState(s.tEndAt);
  const [tNow, setTNow] = useState(Date.now());
  // Remaining plain-timer time preserved while paused.
  const [tHold, setTHold] = useState(s.tHold || 0);

  // Fullscreen flip-clock overlay.
  const [flipOpen, setFlipOpen] = useState(false);

  // Active alert (finish event needing acknowledgement). A cached alert from a
  // previous visit is replayed on load so it "shows" again.
  const [alert, setAlert] = useState(() => {
    const cached = readJson(ALERT_KEY, []);
    return Array.isArray(cached) && cached.length > 0 ? cached[cached.length - 1] : null;
  });
  const repeatRef = useRef(null);
  const alertRef = useRef(alert);
  alertRef.current = alert;
  const soundRef = useRef(soundId);
  soundRef.current = soundId;
  const notifRef = useRef(notif);
  notifRef.current = notif;
  const repeatRefVal = useRef(repeat);
  repeatRefVal.current = repeat;

  // Persist settings.
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ workM, breakM, soundId, phase, pomodoros, repeat, mode, tH, tM, tS, tRunning, tEndAt, tHold })
    );
  }, [workM, breakM, soundId, phase, pomodoros, repeat, mode, tH, tM, tS, tRunning, tEndAt, tHold]);

  // Persist + clear cache once an alert is acknowledged or replaced.
  useEffect(() => {
    if (alert) {
      localStorage.setItem(ALERT_KEY, JSON.stringify([alert]));
    } else {
      localStorage.removeItem(ALERT_KEY);
    }
  }, [alert]);

  const tTotal = (tH * 3600 + tM * 60 + tS) * 1000;
  const tRemaining = tRunning && tEndAt ? Math.max(0, tEndAt - tNow) : tHold > 0 ? tHold : tTotal;

  // Ticks while a timer is live.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!tRunning) return;
    const id = setInterval(() => setTNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [tRunning]);

  /* ---------- alert machinery: play, repeat, notify ---------- */

  const fireSound = () => {
    const sound = SOUNDS.find((x) => x.id === soundRef.current) || SOUNDS[0];
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
    sound.play();
  };

  const pushNotif = (kind, label) => {
    if (notifRef.current === false && "Notification" in window && Notification.permission !== "granted") return;
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(label, { body: kind === "timer" ? "Countdown finished." : "Check your focus session.", tag: "goals-alert" });
      } catch {
        /* popup fallback below */
      }
    }
  };

  const startAlert = (a) => {
    setAlert(a);
    fireSound();
    pushNotif(a.kind, a.label);
    if (repeatRefVal.current) {
      clearInterval(repeatRef.current);
      repeatRef.current = setInterval(() => {
        if (alertRef.current) {
          fireSound();
          pushNotif(alertRef.current.kind, alertRef.current.label);
        }
      }, REPEAT_MS);
    }
  };

  const dismissAlert = () => {
    setAlert(null);
    clearInterval(repeatRef.current);
  };

  useEffect(() => {
    // Cached alert from a previous visit: fire it on load so it "shows".
    if (alert) startAlert(alert);
    return () => clearInterval(repeatRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inviteNotif = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
    setNotif(Notification.permission === "granted");
  };

  /* ---------- focus (pomodoro) ---------- */

  const focusDur = (phase === "work" ? workM : breakM) * 60000;
  const fRemaining = running && endAt ? Math.max(0, endAt - now) : hold > 0 ? hold : focusDur;

  const startFocus = () => {
    if ((phase === "work" && workM <= 0) || (phase === "break" && breakM <= 0)) return;
    dismissAlert();
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(setNotif);
    }
    const resumeMs = hold > 0 ? hold : focusDur;
    setHold(0);
    setEndAt(Date.now() + resumeMs);
    setNow(Date.now());
    setRunning(true);
  };

  const pauseFocus = () => {
    const rem = running && endAt ? Math.max(0, endAt - Date.now()) : 0;
    setHold(rem > 0 ? rem : focusDur);
    setRunning(false);
    setEndAt(null);
  };

  const resetFocus = () => {
    setHold(0);
    setRunning(false);
    setEndAt(null);
  };

  // Focus finished -> switch phase + raise alert.
  useEffect(() => {
    if (!running || !endAt) return;
    if (endAt - now > 40) return;
    const justEnded = phaseRef.current;
    setRunning(false);
    setEndAt(null);
    setHold(0);
    const nextPhase = justEnded === "work" ? "break" : "work";
    if (justEnded === "work") setPomodoros((p) => p + 1);
    setPhase(nextPhase);
    startAlert({
      kind: justEnded,
      label: justEnded === "work" ? "Deep work done — time to rest" : "Rest over — back to deep work",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, endAt, running]);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /* ---------- plain timer ---------- */

  const startTimer = () => {
    const resumeMs = tHold > 0 ? tHold : tTotal;
    if (resumeMs <= 0) return;
    dismissAlert();
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") ctx.resume();
    if (notif && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(setNotif);
    }
    setTEndAt(Date.now() + resumeMs);
    setTHold(0);
    setTNow(Date.now());
    setTRunning(true);
  };

  const stopTimer = () => {
    // Stop without reloading: freeze the remaining time and show Resume.
    const rem = tRunning && tEndAt ? Math.max(0, tEndAt - Date.now()) : 0;
    setTHold(rem > 0 ? rem : 0);
    setTRunning(false);
    setTEndAt(null);
  };

  const setTimer = (h, m, s) => {
    if (tRunning || h < 0 || m < 0 || s < 0) return;
    setTH(Math.min(99, h));
    setTM(Math.min(59, m));
    setTS(Math.min(59, s));
    setTHold(0);
  };

  // Applies a session patch coming from the fullscreen flip clock. The popup
  // and fullscreen share one plain-timer session (absolute end time, so it
  // stays consistent across refreshes too).
  const applyTimerSession = ({ running: r, endAt: e, hold: h, durMs }) => {
    if (r !== undefined) {
      if (r) {
        dismissAlert();
        const ctx = getCtx();
        if (ctx && ctx.state === "suspended") ctx.resume();
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().then(setNotif);
        }
      }
      setTRunning(r);
    }
    if (e !== undefined) setTEndAt(e);
    if (h !== undefined) setTHold(h);
    if (durMs !== undefined) {
      setTH(Math.max(0, Math.min(99, Math.floor(durMs / 3600000))));
      setTM(Math.max(0, Math.min(59, Math.floor((durMs % 3600000) / 60000))));
      setTS(Math.max(0, Math.min(59, Math.floor((durMs % 60000) / 1000))));
      setTHold(0);
    }
  };

  useEffect(() => {
    if (!tRunning || !tEndAt) return;
    if (tEndAt - tNow > 40) return;
    setTRunning(false);
    setTEndAt(null);
    setTHold(0);
    startAlert({ kind: "timer", label: "Timer finished" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tNow, tEndAt, tRunning]);

  /* ---------- render ---------- */

  const label = mode === "focus" ? "Focus" : "Timer";
  const livingRemaining = mode === "focus"
    ? (running ? fRemaining : null)
    : (tRunning ? tRemaining : null);

  return (
    <>
      <div className="fixed bottom-5 left-44 z-40">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm"
          style={{
            background: "var(--color-elevated)",
            color: "var(--color-accent)",
            border: "1px solid var(--color-border-active)",
            boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
            fontFamily: SF,
          }}
          aria-label="Open timer"
          title={label}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" />
          </svg>
          {label}
          {livingRemaining !== null && (
            <span
              className="grid place-items-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums"
              style={{ background: "var(--color-accent)", color: "#101010" }}
            >
              {fmtClock(livingRemaining, mode === "timer")}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          className="notes-backdrop-in fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,31,30,0.32)", backdropFilter: "blur(12px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="notes-pop w-full overflow-hidden rounded-2xl flex flex-col"
            style={{
              maxWidth: 480,
              maxHeight: "88vh",
              fontFamily: SF,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cool glass header — matches the site. Accent turns red on an active alert */}
            <div
              className="relative flex items-center justify-between gap-3 px-4 py-2.5"
              style={{
                background: alert
                  ? "linear-gradient(180deg, rgba(122,44,44,0.55), rgba(92,30,30,0.45))"
                  : "linear-gradient(180deg, rgba(32,85,74,0.5), rgba(30,59,52,0.42))",
                backdropFilter: "blur(18px) saturate(1.6)",
                WebkitBackdropFilter: "blur(18px) saturate(1.6)",
                borderBottom: "1px solid var(--color-border-subtle)",
                boxShadow: "inset 0 1px 0 rgba(229,246,240,0.07), 0 6px 16px rgba(0,0,0,0.35)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {(["focus", "timer"]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); dismissAlert(); }}
                    className="h-7 px-3 rounded-full text-[12px] font-bold cursor-pointer"
                    style={{
                      background: mode === m ? "var(--color-accent)" : "var(--color-sunken)",
                      color: mode === m ? "#101010" : "var(--color-text-secondary)",
                    }}
                  >
                    {m === "focus" ? "Focus" : "Timer"}
                  </button>
                ))}
              </div>
              {pomodoros > 0 && (
                <span
                  className="h-6 px-2.5 rounded-full grid place-items-center text-[11px] font-bold tabular-nums"
                  style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
                >
                  {pomodoros}
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid place-items-center w-7 h-7 rounded-lg cursor-pointer"
                style={{ color: "var(--color-text-secondary)", background: "var(--color-sunken)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <span
                aria-hidden="true"
                className="absolute left-4 right-4 bottom-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(109,245,227,0.5), transparent)" }}
              />
            </div>

            {/* Active alert banner — repeats until dismissed */}
            {alert ? (
              <div
                className="flex items-center justify-between gap-3 px-4 py-2.5"
                style={{
                  background: "linear-gradient(180deg, rgba(122,44,44,0.5), rgba(92,30,30,0.4))",
                  borderBottom: "1px solid rgba(255,150,150,0.18)",
                }}
              >
                <span className="text-[13px] font-semibold text-[#FFC7C7]">
                  ⏰ {alert.label}
                </span>
                <button
                  onClick={dismissAlert}
                  className="h-7 px-3 rounded-full text-[12px] font-bold cursor-pointer text-[#1A0B0B]"
                  style={{ background: "#FF9F9F" }}
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {mode === "focus" ? (
              <FocusPanel
                phase={phase}
                running={running}
                remaining={fRemaining}
                dur={focusDur}
                workM={workM}
                breakM={breakM}
                pomodoros={pomodoros}
                onToggle={running ? pauseFocus : startFocus}
                onSkip={() => {
                  const j = phase;
                  if (j === "work") setPomodoros((p) => p + 1);
                  setPhase(j === "work" ? "break" : "work");
                  resetFocus();
                }}
                onSetWork={(v) => setWorkM(v)}
                onSetBreak={(v) => setBreakM(v)}
                onReset={() => { resetFocus(); setNow(Date.now()); }}
                soundId={soundId}
                onSound={(id) => { setSoundId(id); fireIdle(id); }}
                notif={notif}
                onNotif={inviteNotif}
                repeat={repeat}
                onRepeat={() => setRepeat((r) => !r)}
              />
            ) : (
              <TimerPanel
                h={tH}
                m={tM}
                s={tS}
                running={tRunning}
                paused={!tRunning && tHold > 0}
                remaining={tRemaining}
                endClock={endClock(tEndAt)}
                onSet={setTimer}
                onStart={startTimer}
                onStop={stopTimer}
                onFullscreen={() => setFlipOpen(true)}
                soundId={soundId}
                onSound={(id) => { setSoundId(id); fireIdle(id); }}
                notif={notif}
                onNotif={inviteNotif}
                repeat={repeat}
                onRepeat={() => setRepeat((r) => !r)}
              />
            )}
          </div>
        </div>
      )}
    {/* Fullscreen flip-clock timer — a controlled view of the plain Timer
        session, so the countdown continues in and out of fullscreen. */}
      <FlipClock
        open={flipOpen}
        onClose={() => setFlipOpen(false)}
        session={{ running: tRunning, endAt: tEndAt, hold: tHold, durMs: tTotal }}
        onSession={applyTimerSession}
      />
    </>
  );
}

function fireIdle(id) {
  const sound = SOUNDS.find((x) => x.id === id) || SOUNDS[0];
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
  sound.play();
}

function RevealLabel({ children }) {
  return <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>{children}</span>;
}

function FocusPanel(props) {
  const { phase, running, remaining, dur, workM, breakM, pomodoros, onToggle, onSkip, onSetWork, onSetBreak, onReset, soundId, onSound, notif, onNotif, repeat, onRepeat } = props;
  const ringColor = phase === "work" ? "#FFB340" : "#4BE376";
  const R = 105;
  const C = 2 * Math.PI * R;
  const frac = running ? (dur - remaining) / dur : 0;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  return (
    <div
      className="flex flex-col"
      style={{
        background: "linear-gradient(180deg, rgba(26,46,42,0.96), rgba(18,32,29,0.98))",
        backdropFilter: "blur(20px) saturate(1.3)",
      }}
    >
      <div className="flex items-center justify-center gap-2 pt-4">
        <span
          className="h-6 px-3 rounded-full text-[12px] font-bold grid place-items-center"
          style={{ background: "rgba(255,179,64,0.14)", color: ringColor, border: "1px solid rgba(255,179,64,0.28)" }}
        >
          {phase === "work" ? "Deep Work" : "Rest"}
        </span>
        <RevealLabel>session {pomodoros > 0 ? pomodoros : 0}</RevealLabel>
      </div>

      <div className="relative grid place-items-center mx-auto" style={{ width: 236, height: 236, marginTop: 4 }}>
        <svg width="236" height="236" viewBox="0 0 236 236" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="118" cy="118" r={R} fill="none" stroke="rgba(109,245,227,0.08)" strokeWidth="12" />
          <circle
            cx="118" cy="118" r={R} fill="none"
            stroke={ringColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={running ? C * (1 - frac) : C}
            style={{ transition: "stroke-dashoffset 0.3s linear" }}
          />
        </svg>
        <div
          className="absolute grid place-items-center rounded-full"
          style={{ width: 190, height: 190, background: "rgba(6,16,14,0.72)", border: "1px solid rgba(109,245,227,0.14)" }}
        >
          <div className="flex flex-col items-center" style={{ fontVariantNumeric: "tabular-nums" }}>
            <span className="text-[54px] font-semibold leading-none" style={{ color: "#EAFBF8", letterSpacing: "-0.02em" }}>
              {pad2(mm)}:{pad2(ss)}
            </span>
            <span className="mt-1.5 text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
              {phase === "work" ? "stay deep" : "recharge"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2.5 pt-3">
        <button
          onClick={onToggle}
          className="h-10 px-6 rounded-full font-bold text-[14px] cursor-pointer"
          style={{ background: "var(--color-accent)", color: "#101010", boxShadow: "0 0 22px rgba(109,245,227,0.35)" }}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={onSkip}
          className="h-10 px-4 rounded-full font-semibold text-[14px] cursor-pointer"
          style={{ background: "var(--color-sunken)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-subtle)" }}
        >
          Skip
        </button>
        <button
          onClick={onReset}
          className="h-10 w-10 grid place-items-center rounded-full cursor-pointer"
          style={{ background: "var(--color-sunken)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-subtle)" }}
          aria-label="Reset"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-center gap-4 px-5 pt-4 pb-3">
        {[
          { label: "Work", val: workM, set: onSetWork, color: "#FFB340" },
          { label: "Rest", val: breakM, set: onSetBreak, color: "#4BE376" },
        ].map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="text-[11px] font-bold" style={{ color: d.color }}>{d.label}</span>
            <button
              onClick={() => d.set(Math.max(1, d.val - 1))}
              className="w-6 h-6 rounded-full grid place-items-center font-bold cursor-pointer"
              style={{ background: "var(--color-sunken)", color: "var(--color-text-secondary)" }}
              aria-label={`- ${d.label}`}
            >−</button>
            <span className="text-[14px] font-bold tabular-nums w-6 text-center" style={{ color: "#EAFBF8" }}>{d.val}</span>
            <button
              onClick={() => d.set(Math.min(120, d.val + 1))}
              className="w-6 h-6 rounded-full grid place-items-center font-bold cursor-pointer"
              style={{ background: "var(--color-sunken)", color: "var(--color-text-secondary)" }}
              aria-label={`+ ${d.label}`}
            >+</button>
            <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>min</span>
          </div>
        ))}
      </div>

      {/* Alert options */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap"
        style={{ borderTop: "1px solid var(--color-border-subtle)", background: "rgba(6,16,14,0.4)" }}
      >
        <RevealLabel>when time's up</RevealLabel>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SOUNDS.map((sd) => (
            <button
              key={sd.id}
              onClick={() => onSound(sd.id)}
              className="h-6 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer"
              style={{
                background: soundId === sd.id ? "rgba(109,245,227,0.16)" : "var(--color-sunken)",
                border: soundId === sd.id ? "1px solid var(--color-accent)" : "1px solid var(--color-border-subtle)",
                color: soundId === sd.id ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
            >
              {sd.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div className="flex items-center gap-4">
          <ToggleRow label="Repeat" on={repeat} onToggle={onRepeat} />
          <ToggleRow label="Alerts" on={notif} onToggle={onNotif} />
        </div>
        <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>sound repeats until dismissed</span>
      </div>
    </div>
  );
}

function TimerPanel(props) {
  const { h, m, s, running, paused, remaining, endClock, onSet, onStart, onStop, onFullscreen, soundId, onSound, notif, onNotif, repeat, onRepeat } = props;
  const presets = [
    { label: "10 min", h: 0, m: 10, s: 0 },
    { label: "30 min", h: 0, m: 30, s: 0 },
    { label: "1 h", h: 1, m: 0, s: 0 },
    { label: "10 h", h: 10, m: 0, s: 0 },
  ];
  const hh = Math.floor(remaining / 3600000);
  const mm = Math.floor((remaining % 3600000) / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="relative flex flex-col" style={{ background: "#000000" }}>
      {/* big black clock */}
      <div className="flex flex-col items-center pt-7 pb-6 px-4">
        <button
          onClick={onFullscreen}
          aria-label="Fullscreen timer"
          title="Fullscreen flip clock"
          className="absolute top-3 right-3 grid place-items-center w-8 h-8 rounded-lg cursor-pointer"
          style={{ color: "#A1A1A6", background: "#1C1C1E", border: "1px solid #2C2C2E" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
        <div className="flex items-end" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span className="text-[84px] font-medium leading-none" style={{ color: "#FFFFFF", letterSpacing: "-0.03em" }}>{pad2(hh)}</span>
          <span className="text-[84px] font-medium leading-none pb-[2px]" style={{ color: "#FFFFFF", opacity: 0.9 }}>:</span>
          <span className="text-[84px] font-medium leading-none" style={{ color: "#FFFFFF", letterSpacing: "-0.03em" }}>{pad2(mm)}</span>
          <span className="text-[84px] font-medium leading-none pb-[2px]" style={{ color: "#FFFFFF", opacity: 0.9 }}>:</span>
          <span className="text-[84px] font-medium leading-none" style={{ color: "#FFFFFF", letterSpacing: "-0.03em" }}>{pad2(ss)}</span>
        </div>
        <span className="mt-2 text-[13px] font-semibold" style={{ color: "#8E8E93" }}>
          {running ? (endClock || "counting") : paused ? "paused" : "ready"}
        </span>
      </div>

      {/* set time */}
      <div className="flex items-center justify-center gap-3 px-4 pb-4" style={{ border: "none" }}>
        {[
          { label: "h", val: h, step: (v) => Math.min(99, Math.max(0, v)) },
          { label: "min", val: m, step: (v) => Math.min(59, Math.max(0, v)) },
          { label: "s", val: s, step: (v) => Math.min(59, Math.max(0, v)) },
        ].map((d, i) => (
          <div key={d.label} className="flex flex-col items-center gap-1">
            <button
              onClick={() => running ? null : bump(i, +1)}
              disabled={running}
              className="w-10 h-8 rounded-lg text-[15px] font-bold cursor-pointer disabled:opacity-30"
              style={{ background: "#1C1C1E", color: "#EBEBF0" }}
              aria-label={`+ ${d.label}`}
            >+</button>
            <span className="text-[24px] font-medium tabular-nums w-12 text-center" style={{ color: "#FFFFFF" }}>{pad2(d.val)}</span>
            <button
              onClick={() => running ? null : bump(i, -1)}
              disabled={running}
              className="w-10 h-8 rounded-lg text-[15px] font-bold cursor-pointer disabled:opacity-30"
              style={{ background: "#1C1C1E", color: "#EBEBF0" }}
              aria-label={`- ${d.label}`}
            >−</button>
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#8E8E93" }}>{d.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 px-4 pb-4">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => running ? null : onSet(p.h, p.m, p.s)}
            disabled={running}
            className="h-7 px-3 rounded-full text-[12px] font-semibold cursor-pointer disabled:opacity-30"
            style={{ background: "#1C1C1E", color: "#EBEBF0" }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 px-4 pb-4">
        <button
          onClick={running ? onStop : onStart}
          className="h-12 px-8 rounded-full font-bold text-[15px] cursor-pointer"
          style={{ background: running ? "#FF453A" : "#30D158", color: "#000000" }}
        >
          {running ? "Stop" : paused ? "Resume" : "Start"}
        </button>
      </div>

      {/* Alert options */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap"
        style={{ borderTop: "1px solid #2C2C2E", background: "#0A0A0C" }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#8E8E93" }}>when time's up</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SOUNDS.map((sd) => (
            <button
              key={sd.id}
              onClick={() => onSound(sd.id)}
              className="h-6 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer"
              style={{
                background: soundId === sd.id ? "#22D3EE" : "#1C1C1E",
                border: soundId === sd.id ? "1px solid #22D3EE" : "1px solid #2C2C2E",
                color: soundId === sd.id ? "#000000" : "#EBEBF0",
              }}
            >
              {sd.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: "1px solid #2C2C2E", background: "#0A0A0C" }}>
        <div className="flex items-center gap-4">
          <ToggleRow label="Repeat" on={repeat} onToggle={onRepeat} />
          <ToggleRow label="Alerts" on={notif} onToggle={onNotif} />
        </div>
        <span className="text-[10px]" style={{ color: "#8E8E93" }}>sound repeats until dismissed</span>
      </div>
    </div>
  );

  function bump(i, dir) {
    const deltas = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const [dh, dm, ds] = deltas[i];
    const nv = [h + dh * dir, m + dm * dir, s + ds * dir];
    onSet(...normalize(nv));
  }
  function normalize([h, m, s]) {
    if (s < 0) { s += 60; m -= 1; }
    if (m < 0) { m += 60; h -= 1; }
    if (s > 59) { s = 0; m += 1; }
    if (m > 59) { m = 0; h += 1; }
    return [Math.max(0, h), Math.max(0, m), Math.max(0, s)];
  }
}

function ToggleRow({ label, on, onToggle }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold" style={{ color: "var(--color-text-tertiary)" }}>{label}</span>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        className="relative w-8 h-5 rounded-full transition-colors cursor-pointer"
        style={{ background: on ? "#34C759" : "rgba(109,245,227,0.16)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
          style={{ left: on ? 14 : 1.5, transition: "left 0.18s ease" }}
        />
      </button>
    </div>
  );
}

function hasNotifPerm() {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

function soundIdFrom(s) {
  return SOUNDS.some((x) => x.id === s.soundId) ? s.soundId : "tritone";
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