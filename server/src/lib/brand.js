/**
 * Server-side brand strings. One place, so an email template and an API error
 * can never drift apart from the product name.
 */
export const BRAND = {
  name: "Paceline",
  founder: "Tchizu",
  tagline: "Set goals. Stay on pace.",
  year: 2026,
  siteUrl: process.env.PUBLIC_SITE_URL || "https://saadfaid.github.io/goals-tracker",
  supportEmail: process.env.SUPPORT_EMAIL || "support@paceline.app",
};
