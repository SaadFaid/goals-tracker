import { useEffect, useRef, useState } from "react";

/** Count-up animation for stat numbers. Respects prefers-reduced-motion. */
export function useCountUp(value, duration = 300) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      prevRef.current = value;
      // Syncs the displayed number with the new external value without animating.
      // oxlint-disable-next-line react/set-state-in-effect
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const delta = value - prev;
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(prev + delta * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else prevRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}
