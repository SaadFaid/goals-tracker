import { BRAND } from "../lib/brand";

/** The Paceline mark, painted from the supplied logo artwork. */
export const MARK_SRC = `${import.meta.env.BASE_URL}paceline-mark.png`;

export function BrandMark({ size = 18, className = "" }) {
  const box = size + 14;
  return (
    <span
      className={`grid place-items-center shrink-0 ${className}`}
      style={{
        width: box,
        height: box,
        borderRadius: 10,
        background: "var(--color-accent-muted)",
        boxShadow: "0 0 18px rgba(109,245,227,0.35)",
      }}
      aria-hidden="true"
    >
      <img
        src={MARK_SRC}
        alt=""
        width={size * 1.4}
        height={size}
        style={{ width: "auto", height: size, display: "block" }}
      />
    </span>
  );
}

/**
 * The wordmark. The display font, the existing accent colour, plus the mark
 * wherever the space allows.
 */
export default function Brand({ size = "md", withMark = true, className = "" }) {
  const sizes = {
    sm: { fontSize: 14 },
    md: { fontSize: 16 },
    lg: { fontSize: 22 },
    xl: { fontSize: 30 },
  };
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {withMark ? <BrandMark size={size === "sm" ? 13 : 16} /> : null}
      <span
        className="brand leading-none"
        style={{
          ...(sizes[size] || sizes.md),
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--color-accent)",
          filter: "drop-shadow(0 0 14px rgba(109,245,227,0.25))",
        }}
      >
        {BRAND.name}
      </span>
    </span>
  );
}
