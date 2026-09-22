import { useEffect, useRef, useState } from "react";

const SF =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif";

const PRESETS = [
  { label: "10", min: 10 },
  { label: "25", min: 25 },
  { label: "50", min: 50 },
  { label: "60", min: 60 },
];

const clampMins = (m) => Math.max(1, Math.min(180, Math.round(m)));

function useTileSize(nGroups) {
  const [h, setH] = useState(() => calcFor(nGroups, window.innerWidth, window.innerHeight));
  useEffect(() => {
    const onR = () => setH(calcFor(nGroups, window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [nGroups]);
  return h;
}

// Fit the tile row to the viewport and make it as large as possible.
function calcFor(nGroups, vw, vh) {
  const fromW = Math.floor(vw / (nGroups * 1.62));
  const fromH = Math.floor(vh * 0.5);
  return Math.max(90, Math.min(Math.min(fromW, fromH), 340));
}

/**
 * Fullscreen split-flap focus timer — a CONTROLLED view of a shared session.
 * The same session lives in the caller (the Focus tab); starting / pausing /
 * skipping here updates it there, and vice versa, so the countdown just
 * continues seamlessly in and out of fullscreen.
 *
 * Props:
 *   open        bool
 *   onClose     () => void
 *   session     { running, endAt, hold, mins }
 *   onSession   (patch: { running?, endAt?, hold?, mins? }) => void
 */
export default function FlipClock({ open, onClose, session, onSession }) {
  const [now, setNow] = useState(Date.now());
  const will = useRef(session);

  const mins = session.mins;
  const running = !!session.running;
  const endAt = session.endAt;
  const hold = session.hold || 0;

  useEffect(() => {
    will.current = session;
  }, [session]);

  useEffect(() => {
    if (running) {
      const id = setInterval(() => setNow(Date.now()), 200);
      return () => clearInterval(id);
    }
  }, [running]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const total = mins * 60000;
  const remaining = running && endAt ? Math.max(0, endAt - now) : hold > 0 ? hold : total;
  const finished = !running && remaining <= 0 && total > 0;

  const totalS = Math.round(remaining / 1000);
  const hh = Math.floor(totalS / 3600);
  const mm = Math.floor((totalS % 3600) / 60);
  const ss = totalS % 60;
  const groups = hh > 0 ? [hh, mm, ss] : [mm, ss];

  const tileH = useTileSize(groups.length);
  const tileW = Math.round(tileH * 0.62);
  const fontSize = Math.round(tileH * 0.78);

  const progress = running ? 1 - remaining / total : finished ? 1 : 0;

  const startOrResume = () => {
    const pad = will.current;
    const dur = (pad.hold > 0 ? pad.hold : pad.mins * 60000);
    onSession({ running: true, endAt: Date.now() + dur, hold: 0 });
  };
  const pause = () => {
    const pad = will.current;
    const rem = pad.endAt ? Math.max(0, pad.endAt - Date.now()) : pad.mins * 60000;
    onSession({ running: false, endAt: null, hold: rem });
  };
  const reset = () => onSession({ running: false, endAt: null, hold: 0 });
  const bump = (d) => {
    if (running) return;
    onSession({ running: false, endAt: null, hold: 0, mins: clampMins(mins + d) });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ background: "#000000", fontFamily: SF }}
    >
      {/* progress sliver along the top */}
      <div
        className="fc-progress"
        style={{ transform: `scaleX(${progress})`, width: "100%" }}
      />

      {/* close — subtle, top corner */}
      <button
        onClick={onClose}
        aria-label="Exit fullscreen"
        className="fixed top-5 right-5 w-11 h-11 grid place-items-center rounded-full cursor-pointer z-[95] transition-opacity hover:opacity-100"
        style={{ background: "rgba(255,255,255,0.07)", color: "#A1A1A6", border: "1px solid rgba(255,255,255,0.12)", opacity: 0.75 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* label top-left */}
      <div className="fixed top-6 left-6 flex items-center gap-2 z-[95]">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#58585D" }}>
          Focus
        </span>
        <span className="h-5 px-2 rounded-full grid place-items-center text-[11px] font-semibold tabular-nums" style={{ background: "rgba(255,255,255,0.08)", color: "#A1A1A6" }}>
          {mins} min
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* flip tiles */}
        <div className="flex items-center" style={{ gap: Math.max(8, Math.round(tileH * 0.08)) }}>
          {groups.map((v, i) => (
            <div key={i} className="flex items-center" style={{ gap: Math.max(8, Math.round(tileH * 0.08)) }}>
              {i > 0 && <Colon size={Math.max(7, Math.round(tileH * 0.12))} height={tileH} />}
              <FlipTile value={v} width={tileW} height={tileH} fontSize={fontSize} />
            </div>
          ))}
        </div>

        <p className="mt-6 text-[13px] font-semibold" style={{ color: "#58585D" }}>
          {running ? "focusing" : finished ? "done — take a break" : hold > 0 ? "paused" : "tap start when you're ready"}
        </p>

        {/* finished banner */}
        {finished && (
          <button
            onClick={reset}
            className="mt-4 h-10 px-6 rounded-full font-bold text-[14px] cursor-pointer"
            style={{ background: "#22D3EE", color: "#000000", boxShadow: "0 0 40px rgba(34,211,238,0.5)" }}
          >
            Time's up — rest!
          </button>
        )}
      </div>

      {/* controls */}
      <div className="flex flex-col items-center gap-4 pb-10 px-4">
        {/* minute stepper + presets */}
        <div className="flex items-center gap-3">
          <StepperBtn onClick={() => bump(-1)} label="−" />
          <div className="flex items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => !running && onSession({ running: false, endAt: null, hold: 0, mins: p.min })}
                disabled={running}
                className="h-8 px-3 rounded-full text-[12px] font-semibold cursor-pointer disabled:opacity-30"
                style={{
                  background: mins === p.min ? "#22D3EE" : "rgba(255,255,255,0.07)",
                  color: mins === p.min ? "#000000" : "#A1A1A6",
                  border: mins === p.min ? "1px solid #22D3EE" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {p.min}
              </button>
            ))}
          </div>
          <StepperBtn onClick={() => bump(1)} label="+" />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={running ? pause : startOrResume}
            className="h-14 px-10 rounded-full font-bold text-[16px] cursor-pointer"
            style={{ background: running ? "#FF453A" : "#22D3EE", color: "#000000", boxShadow: "0 6px 24px rgba(34,211,238,0.35)" }}
          >
            {running ? "Pause" : hold > 0 ? "Resume" : "Start"}
          </button>
          <button
            onClick={reset}
            aria-label="Reset"
            className="h-14 w-14 grid place-items-center rounded-full cursor-pointer"
            style={{ background: "rgba(255,255,255,0.07)", color: "#A1A1A6", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function Colon({ size, height }) {
  return (
    <div className="flip-colon" style={{ width: size, height }}>
      <span style={{ width: size, height: size }} />
      <span style={{ width: size, height: size }} />
    </div>
  );
}

function StepperBtn({ onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="h-12 w-12 grid place-items-center rounded-full text-[24px] font-bold cursor-pointer"
      style={{ background: "rgba(255,255,255,0.07)", color: "#D7D7DB", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      {label}
    </button>
  );
}

/** One flip tile for a single digit. */
function FlipTile({ value, width, height, fontSize }) {
  const digit = String(value % 10);
  const [oldVal, setOldVal] = useState(digit);
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    if (oldVal === digit) return;
    setAnim((k) => k + 1);
    const t = setTimeout(() => setOldVal(digit), 440);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit]);

  const digitStyle = { fontSize, lineHeight: `${height}px`, height };

  return (
    <div className="flip-tile" style={{ width, height }}>
      <div className="flip-half top">
        <span className="flip-digit" style={digitStyle}>{digit}</span>
      </div>
      <div className="flip-half bottom">
        <span className="flip-digit" style={digitStyle}>{digit}</span>
      </div>

      {anim > 0 && (
        <>
          <div key={`o${anim}`} className="flip-fold old">
            <span className="flip-digit" style={digitStyle}>{oldVal}</span>
          </div>
          <div key={`n${anim}`} className="flip-fold new">
            <span className="flip-digit" style={digitStyle}>{digit}</span>
          </div>
        </>
      )}

      <div className="flip-divider" />
    </div>
  );
}