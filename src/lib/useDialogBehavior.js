import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The behaviour every popup shares: lock the page behind it, close on Escape,
 * and keep Tab inside the panel. Returns the ref to put on the panel element.
 *
 * `open` toggles it, `onClose` is called on Escape. Panels themselves render
 * role="dialog" aria-modal="true" so screen readers announce them.
 */
export default function useDialogBehavior(open, onClose) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);

  // Keep the latest handler without re-running the effect on every render.
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    // Move focus into the panel so the trap has somewhere to start. The delay
    // lets the open animation finish and keeps it from stealing a field the
    // panel focused itself.
    const timer = setTimeout(() => {
      const root = panelRef.current;
      if (!root || root.contains(document.activeElement)) return;
      const target = root.querySelector("input, textarea, [data-autofocus], button");
      if (target) target.focus();
      else root.focus();
    }, 60);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = prevOverflow;
    };
  }, [open]);

  return panelRef;
}
