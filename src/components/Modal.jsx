import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one popup shell every dialog in Paceline uses.
 *
 * Desktop: a centered card. Mobile: a bottom sheet that slides up and can be
 * flicked away by its drag handle. It owns the rules the whole app shares —
 * focus is trapped, the page behind does not scroll, Esc and the overlay
 * close it, and only one dialog is ever mounted (the host renders a single
 * one at a time).
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  // Return false from this to keep the dialog open (a form with unsaved text).
  confirmClose,
  labelId,
  className = "",
}) {
  const panelRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const autoId = useId();
  const titleId = labelId || `dlg-title-${autoId}`;

  // Mount / unmount with a short exit animation.
  useEffect(() => {
    if (open) {
      setRendered(true);
      setLeaving(false);
      return undefined;
    }
    if (!rendered) return undefined;
    setLeaving(true);
    const t = setTimeout(() => {
      setRendered(false);
      setLeaving(false);
    }, 190);
    return () => clearTimeout(t);
  }, [open, rendered]);

  const requestClose = useCallback(() => {
    if (confirmClose && confirmClose() === false) return;
    onClose?.();
  }, [confirmClose, onClose]);

  // Lock the page behind the dialog and trap the focus inside it.
  useEffect(() => {
    if (!rendered) return undefined;
    const previous = document.activeElement;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    if (first) {
      // The first field takes focus; a heading-only dialog focuses itself.
      requestAnimationFrame(() => {
        const again = panelRef.current?.querySelector(FOCUSABLE);
        if (again) again.focus();
      });
    } else {
      panel?.focus?.();
    }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const list = Array.from(nodes).filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (list.length === 0) return;
      const firstNode = list[0];
      const lastNode = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = prevOverflow;
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, [rendered, requestClose]);

  // Drag-to-dismiss on the mobile sheet handle.
  const dragRef = useRef(null);
  const onHandleDown = (e) => {
    if (e.pointerType === "mouse") return;
    dragRef.current = { startY: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.startY);
    setDragY(d.dy);
  };
  const onHandleUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.dy > 90) requestClose();
    setDragY(0);
  };

  if (!rendered) return null;

  const widths = { sm: "sm:max-w-[380px]", md: "sm:max-w-[440px]", lg: "sm:max-w-[620px]" };

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(8, 20, 19, 0.62)", backdropFilter: "blur(10px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-panel card w-full ${widths[size] || widths.md} max-h-[92vh] sm:max-h-[86vh] flex flex-col overflow-hidden ${className}`}
        style={{
          borderRadius: "var(--radius-lg)",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : undefined,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile sheet affordance. */}
        <div
          className="sm:hidden pt-2 pb-1 flex justify-center shrink-0 cursor-grab touch-none"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          aria-hidden="true"
        >
          <span
            className="block rounded-full"
            style={{ width: 38, height: 4, background: "var(--color-border-active)" }}
          />
        </div>

        {/* Title top-left, X top-right. */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="h2 text-heading" style={{ fontSize: 17 }}>
              {title}
            </h2>
            {subtitle ? (
              <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="grid place-items-center w-8 h-8 rounded-lg shrink-0 cursor-pointer transition-colors"
            style={{ color: "var(--color-text-tertiary)", border: "1px solid var(--color-border-subtle)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-text-primary)";
              e.currentTarget.style.borderColor = "var(--color-border-active)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-text-tertiary)";
              e.currentTarget.style.borderColor = "var(--color-border-subtle)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content. */}
        <div className="px-5 pb-4 overflow-y-auto grow min-h-0">{children}</div>

        {/* Buttons: secondary left, primary right. */}
        {footer ? (
          <div
            className="px-5 py-3.5 flex items-center gap-2 shrink-0"
            style={{ borderTop: "1px solid var(--color-border-subtle)", background: "var(--color-sunken)" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
