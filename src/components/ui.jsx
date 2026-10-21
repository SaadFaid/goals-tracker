import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dismissToast, subscribe } from "../lib/toast";

/**
 * The small set of atoms every new screen shares, built from the existing
 * theme tokens (the app already had a look — these reuse it rather than
 * inventing a second one).
 */

export function Btn({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  busy = false,
  className = "",
  title,
  ariaLabel,
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-bold cursor-pointer transition-all btn-lift disabled:opacity-45 disabled:cursor-not-allowed";
  const sizes = {
    sm: "h-8 px-3 text-[11px]",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-[15px]",
  };
  const styles = {
    primary: {
      background: "var(--color-accent)",
      color: "#101010",
      boxShadow: "0 0 18px rgba(109,245,227,0.30)",
    },
    secondary: {
      background: "transparent",
      color: "var(--color-text-primary)",
      border: "1px solid var(--color-border-active)",
    },
    ghost: {
      background: "transparent",
      color: "var(--color-text-secondary)",
    },
    danger: {
      background: "transparent",
      color: "var(--color-danger)",
      border: "1px solid rgba(219,96,136,0.45)",
    },
  };
  return (
    <button
      type={type}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled || busy}
      className={`${base} ${sizes[size] || sizes.md} ${className}`}
      style={styles[variant] || styles.primary}
    >
      {busy ? (
        <span
          className="w-3 h-3 rounded-full border-2 animate-spin"
          style={{ borderColor: "rgba(0,0,0,0.25)", borderTopColor: "#101010" }}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, id, required }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="caption text-text-tertiary">
          {label}
          {required ? <span style={{ color: "var(--color-accent)" }}> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[11px]" style={{ color: "var(--color-danger)" }} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ id, value, onChange, placeholder, type = "text", autoComplete, inputMode, className = "", ...rest }) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full bg-sunken text-heading text-sm rounded-lg px-3 py-2.5 outline-none transition-colors ${className}`}
      style={{ border: "1px solid var(--color-border-subtle)" }}
      {...rest}
    />
  );
}

export function Select({ id, value, onChange, children, className = "" }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full bg-sunken text-heading text-sm rounded-lg px-3 py-2.5 outline-none ${className}`}
      style={{ border: "1px solid var(--color-border-subtle)" }}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint, id }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm text-heading cursor-pointer">
          {label}
        </label>
        {hint ? <p className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed">{hint}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="shrink-0 w-11 h-6 rounded-full relative cursor-pointer transition-colors"
        style={{
          background: checked ? "var(--color-accent-muted)" : "var(--color-sunken)",
          border: `1px solid ${checked ? "var(--color-accent)" : "var(--color-border-active)"}`,
        }}
      >
        <span
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all"
          style={{
            left: checked ? 24 : 3,
            background: checked ? "var(--color-accent)" : "var(--color-text-tertiary)",
            boxShadow: checked ? "0 0 10px rgba(109,245,227,0.5)" : "none",
            transition: "left 0.18s ease, background 0.18s ease",
          }}
        />
      </button>
    </div>
  );
}

export function SectionLabel({ children }) {
  return <p className="caption text-text-tertiary mb-2">{children}</p>;
}

export function Divider() {
  return <div className="h-px" style={{ background: "var(--color-border-subtle)" }} />;
}

/** The one toast surface. Mounted once, at the root. */
export function Toaster() {
  const [item, setItem] = useState(null);

  useEffect(() => subscribe(setItem), []);

  if (!item) return null;

  const tone =
    item.tone === "error"
      ? { color: "var(--color-danger)", border: "rgba(219,96,136,0.5)" }
      : { color: "var(--color-accent)", border: "rgba(109,245,227,0.4)" };

  return createPortal(
    <div
      className="fixed z-[90] left-1/2 -translate-x-1/2 bottom-6 px-3"
      role="status"
      aria-live="polite"
      onClick={dismissToast}
    >
      <div
        className="toast-in px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{
          background: "var(--color-elevated)",
          color: tone.color,
          border: `1px solid ${tone.border}`,
          boxShadow: "0 12px 34px rgba(0,0,0,0.55)",
        }}
      >
        {item.message}
      </div>
    </div>,
    document.body
  );
}
