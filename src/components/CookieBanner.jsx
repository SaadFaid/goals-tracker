import { useEffect, useState } from "react";
import { Btn } from "./ui";
import { BRAND } from "../lib/brand";

const KEY = "paceline-cookie-consent";

export function cookieChoice() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCookieChoice(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* private mode — the choice simply will not survive a reload */
  }
}

/**
 * Analytics only ever load on an explicit accept. The choice is stored, so the
 * banner is asked once and never again.
 */
export function loadAnalytics() {
  if (cookieChoice() !== "accepted") return;
  if (window.__pacelineAnalyticsLoaded) return;
  window.__pacelineAnalyticsLoaded = true;
  // The analytics snippet goes here once there is a provider to load. Until
  // then, accepting only records the decision.
}

export default function CookieBanner() {
  const [choice, setChoice] = useState(null);

  useEffect(() => {
    setChoice(cookieChoice());
  }, []);

  if (choice) return null;

  const decide = (value) => {
    setCookieChoice(value);
    setChoice(value);
    if (value === "accepted") loadAnalytics();
  };

  return (
    <div
      className="cookie-banner-in fixed z-[70] inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-[420px]"
      role="region"
      aria-label="Cookie notice"
    >
      <div
        className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center"
        style={{ boxShadow: "0 18px 50px rgba(0,0,0,0.55)" }}
      >
        <p className="text-xs leading-relaxed text-muted grow">
          We use analytics cookies to see how {BRAND.name} is used. They load only if you accept.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Btn size="sm" variant="secondary" onClick={() => decide("declined")}>
            Decline
          </Btn>
          <Btn size="sm" onClick={() => decide("accepted")}>
            Accept
          </Btn>
        </div>
      </div>
    </div>
  );
}
