// Named category colors. Each token maps to the hex used for the card's accent
// line + text (headerColor). Keep `name`/`hex` in sync with the server's
// DOT_COLORS (server/src/validation/validate.js) — any new color must be added
// to both, or the server will reject it.

export const CATEGORY_COLORS = {
  turquoise: { hex: "#6DF5E3", label: "Turquoise" },
  white: { hex: "#ffffff", label: "White" },
  pink: { hex: "#DB6088", label: "Pink" },
  purple: { hex: "#B388E0", label: "Purple" },
  blue: { hex: "#6FA8FF", label: "Blue" },
  orange: { hex: "#FFA14D", label: "Orange" },
  green: { hex: "#87FF5F", label: "Green" },
  red: { hex: "#FF5F6D", label: "Red" },
  grey: { hex: "#9AA7B5", label: "Grey" },
  black: { hex: "#000000", label: "Black" },
  yellow: { hex: "#FFD94D", label: "Yellow" },
};

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS);

export function dotColorToHex(dotColor) {
  return CATEGORY_COLORS[dotColor]?.hex || CATEGORY_COLORS.turquoise.hex;
}
