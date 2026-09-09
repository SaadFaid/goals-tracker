// Named category colors. Each token maps to the hex used for the card's accent
// line + text (headerColor). Keep `name`/`hex` in sync with the server's
// DOT_COLORS (server/src/validation/validate.js) — any new color must be added
// to both, or the server will reject it.

export const CATEGORY_COLORS = {
  turquoise: { hex: "#6DF5E3", label: "Turquoise" },
  white: { hex: "#ffffff", label: "White" },
  pink: { hex: "#FF4D8D", label: "Hot pink" },
  purple: { hex: "#B44CFF", label: "Electric violet" },
  blue: { hex: "#4D8DFF", label: "Vivid blue" },
  orange: { hex: "#FF6B35", label: "Vivid orange" },
  green: { hex: "#63E94F", label: "Neon green" },
  red: { hex: "#FF3B47", label: "Vivid red" },
  grey: { hex: "#9AA7B5", label: "Grey" },
  black: { hex: "#000000", label: "Black" },
  yellow: { hex: "#FFE14D", label: "Sunshine yellow" },
};

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS);

export function dotColorToHex(dotColor) {
  return CATEGORY_COLORS[dotColor]?.hex || CATEGORY_COLORS.turquoise.hex;
}
