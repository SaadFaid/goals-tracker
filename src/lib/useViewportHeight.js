import { useEffect } from "react";

/**
 * Keep `--vv-h` / `--vv-top` in sync with the visible part of the page.
 *
 * On iOS the keyboard does not resize the layout viewport: a bottom sheet
 * pinned with `inset-0` ends up *behind* the keys, and after the keyboard
 * closes the sheet is left sitting at the bottom of the page. `visualViewport`
 * does shrink, so dialogs size themselves against these variables instead of
 * `vh`.
 */
export default function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty("--vv-h", `${Math.round(vv.height)}px`);
      root.style.setProperty("--vv-top", `${Math.max(0, Math.round(vv.offsetTop))}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
    };
  }, []);
}
