// Named category colors. Each token maps to the hex used for the card's accent
// line + text (headerColor). Keep `name`/`hex` in sync with the server's
// DOT_COLORS (server/src/validation/validate.js) — any new color must be added
// to both, or the server will reject it.

export const CATEGORY_COLORS = {
  turquoise: { hex: "#1E9E9E", label: "Turquoise" },
  white: { hex: "#ffffff", label: "White" },
  pink: { hex: "#FF4D8D", label: "Hot pink" },
  purple: { hex: "#B44CFF", label: "Electric violet" },
  blue: { hex: "#4D8DFF", label: "Vivid blue" },
  orange: { hex: "#FB8C00", label: "Orange" },
  green: { hex: "#43A047", label: "Green" },
  red: { hex: "#E53935", label: "Red" },
  grey: { hex: "#9AA7B5", label: "Grey" },
  black: { hex: "#000000", label: "Black" },
  yellow: { hex: "#FDD835", label: "Yellow" },
  indigo: { hex: "#3F51B5", label: "Indigo" },
  violet: { hex: "#8E24AA", label: "Violet" },
  gold: { hex: "#C9A227", label: "Gold" },
  pinkwhite: { hex: "#F8BBD0", label: "Pink/White" },
  silver: { hex: "#C0C0C0", label: "Silver" },
  copper: { hex: "#B87333", label: "Copper" },
  rosegold: { hex: "#B76E79", label: "Rose gold" },
};

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS);

export function dotColorToHex(dotColor) {
  return CATEGORY_COLORS[dotColor]?.hex || CATEGORY_COLORS.turquoise.hex;
}
