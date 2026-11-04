import { BRAND } from "../lib/brand";

/** The Paceline mark, painted from the supplied logo artwork. */
export const MARK_SRC = `${import.meta.env.BASE_URL}paceline-mark.png`;
// The same glyph on its dark tile: the mark alone sits on transparency, so at
// a small size its anti-aliased edge reads as stray bits against the page.
export const MARK_TILE_SRC = `${import.meta.env.BASE_URL}icon-192.png`;

export function BrandMark({ size = 18, className = "" }) {
  const box = size + 14;
  return (
    <span
      className={`block shrink-0 overflow-hidden ${className}`}
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.32),
        background: "#0B1514",
        boxShadow: "0 0 18px rgba(109,245,227,0.3)",
      }}
      aria-hidden="true"
    >
      <img
        src={MARK_TILE_SRC}
        alt=""
        width={box}
        height={box}
        style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
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
