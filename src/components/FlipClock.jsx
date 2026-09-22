import { useEffect, useRef, useState } from "react";

const SF =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif";

const PRESETS = [
  { label: "10 min", h: 0, m: 10, s: 0 },
  { label: "30 min", h: 0, m: 30, s: 0 },
  { label: "1 h", h: 1, m: 0, s: 0 },
  { label: "10 h", h: 10, m: 0, s: 0 },
];

const pad2 = (n) => String(n).padStart(2, "0");

function fmtClock(ms) {
  ms = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(ms / 3600);
  const m = Math.floor((ms % 3600) / 60);
  const s = ms % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

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
 * Fullscreen split-flap timer — a CONTROLLED view of a shared session.
 * The same session lives in the caller (the Focus tab); starting / pausing /
 * skipping here updates it there, and vice versa, so the countdown just
 * continues seamlessly in and out of fullscreen.
 *
 * Props:
 *   open        bool
 *   onClose     () => void
 *   session     { running, endAt, hold, durMs }
 *   onSession   (patch: { running?, endAt?, hold?, durMs? }) => void
 */
export default function FlipClock({ open, onClose, session, onSession }) {
  const [now, setNow] = useState(Date.now());
  const will = useRef(session);

  const durMs = session.durMs;
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

  const remaining = running && endAt ? Math.max(0, endAt - now) : hold > 0 ? hold : durMs;
  const finished = !running && remaining <= 0 && durMs > 0;

  const totalS = Math.round(remaining / 1000);
  const hh = Math.floor(totalS / 3600);
  const mm = Math.floor((totalS % 3600) / 60);
  const ss = totalS % 60;
  const groups = [hh, mm, ss];

  const tileH = useTileSize(groups.length);
  const tileW = Math.round(tileH * 0.62);
  const fontSize = Math.round(tileH * 0.78);

  const progress = running ? 1 - remaining / durMs : finished ? 1 : 0;

  // Time picker (mirrors the popup's Timer tab): h / min / s setters.
  const [pk, setPk] = useState({ h: 0, m: 10, s: 0 });
  useEffect(() => {
    if (running) return;
    setPk({
      h: Math.floor(durMs / 3600000),
      m: Math.floor((durMs % 3600000) / 60000),
      s: Math.floor((durMs % 60000) / 1000),
    });
  }, [durMs, running]);

  const pickMs = () => pk.h * 3600000 + pk.m * 60000 + pk.s * 1000;
  const commitPick = () => {
    const ms = pickMs();
    if (ms <= 0) return;
    onSession({ running: false, endAt: null, hold: 0, durMs: ms });
  };
  const bumpPk = (i, d, step) => {
    setPk((p) => {
      const keys = ["h", "m", "s"];
      const next = { ...p };
      next[keys[i]] = step(p[keys[i]] + d);
      return next;
    });
  };
  useEffect(() => {
    if (running) return;
    const id = window.setTimeout(commitPick, 220);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pk]);

  const startOrResume = () => {
    const pad = will.current;
    const dur = pad.hold > 0 ? pad.hold : pad.durMs;
    onSession({ running: true, endAt: Date.now() + dur, hold: 0 });
  };
  const pause = () => {
    const pad = will.current;
    const rem = pad.endAt ? Math.max(0, pad.endAt - Date.now()) : pad.durMs;
    onSession({ running: false, endAt: null, hold: rem });
  };
  const reset = () => onSession({ running: false, endAt: null, hold: 0 });

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
        className="fixed top-5 right-5 w-11 h-11 grid place-items-center rounded-full cursor-pointer transition-opacity hover:opacity-100 z-[95]"
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
          {fmtClock(durMs)}
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
        {/* h / min / s pickers — only before start or after it's stopped */}
        {!running && (
          <>
            <div className="flex items-center justify-center gap-3" style={{ border: "none" }}>
              {[
                { label: "h", val: pk.h, step: (v) => Math.min(99, Math.max(0, v)) },
                { label: "min", val: pk.m, step: (v) => Math.min(59, Math.max(0, v)) },
                { label: "s", val: pk.s, step: (v) => Math.min(59, Math.max(0, v)) },
              ].map((d, i) => (
                <div key={d.label} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => bumpPk(i, +1, d.step)}
                    className="w-12 h-8 rounded-lg text-[15px] font-bold cursor-pointer"
                    style={{ background: "#1C1C1E", color: "#EBEBF0" }}
                    aria-label={`+ ${d.label}`}
                  >+</button>
                  <span className="text-[26px] font-medium tabular-nums w-14 text-center" style={{ color: "#FFFFFF" }}>{pad2(d.val)}</span>
                  <button
                    onClick={() => bumpPk(i, -1, d.step)}
                    className="w-12 h-8 rounded-lg text-[15px] font-bold cursor-pointer"
                    style={{ background: "#1C1C1E", color: "#EBEBF0" }}
                    aria-label={`- ${d.label}`}
                  >−</button>
                  <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#8E8E93" }}>{d.label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() =>
                    onSession({ running: false, endAt: null, hold: 0, durMs: (p.h * 3600 + p.m * 60 + p.s) * 1000 })
                  }
                  className="h-7 px-3 rounded-full text-[12px] font-semibold cursor-pointer"
                  style={{ background: "#1C1C1E", color: "#EBEBF0" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

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