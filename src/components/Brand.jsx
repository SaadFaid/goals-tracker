import { BRAND } from "../lib/brand";

/** The Paceline mark — the app's existing lens glyph, untouched. */
export function BrandMark({ size = 18, className = "" }) {
  return (
    <span
      className={`grid place-items-center shrink-0 ${className}`}
      style={{
        width: size + 14,
        height: size + 14,
        borderRadius: 10,
        background: "var(--color-accent-muted)",
        color: "var(--color-accent)",
        boxShadow: "0 0 18px rgba(109,245,227,0.35)",
      }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}

/**
 * The wordmark. Text only, the existing display font, the existing accent
 * colour — no copied artwork anywhere in the product.
 */
export default function Brand({ size = "md", withMark = false, className = "" }) {
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
