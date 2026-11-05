// Analytics boundary for Relationship Copilot.
//
// This app holds unusually sensitive material — who someone is close to, and
// what they said to them. So browser measurement is deliberately confined to
// the public marketing surface. The GTM snippet never loads behind auth, which
// also means no connection, invite, or account IDs leak through a URL path.
//
// Three places encode the same browser boundary and must stay in step:
//   1. this file (decides whether the GTM snippet loads at all),
//   2. the GTM container's "Marketing Pages" triggers
//      (Page Path does not match ^/(connections|account|onboarding|auth|invite)),
//   3. app/robots.ts, which keeps the same routes out of search.
//
// The one server-side exception is the anonymous Measurement Protocol ping for
// `first_mutual_reveal_completed` (see lib/ga4.ts) — no path or identity
// fields, same GA4 property the GTM container feeds.

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/** Authenticated or otherwise private areas. Never measured. */
export const PRIVATE_PATH_PREFIXES = [
  "/connections",
  "/account",
  "/onboarding",
  "/auth",
  "/invite",
] as const;

/** True when this path is part of the public marketing surface. */
export function isMeasurablePath(pathname: string): boolean {
  return !PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// The crisis page must never greet someone with a cookie dialog. It stays
// measurable (so it still counts if consent was already given elsewhere), but
// it never prompts.
const NO_PROMPT_PATHS = ["/safety"] as const;

/** True when we may show the consent banner on this path. */
export function shouldPromptForConsent(pathname: string): boolean {
  return (
    isMeasurablePath(pathname) &&
    !NO_PROMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

export const CONSENT_STORAGE_KEY = "rc-analytics-consent";

export type ConsentChoice = "granted" | "denied";

/** Parse a stored consent value (localStorage or first-party cookie). */
export function parseAnalyticsConsent(
  raw: string | null | undefined,
): ConsentChoice | null {
  return raw === "granted" || raw === "denied" ? raw : null;
}

export function readStoredConsent(): ConsentChoice | null {
  try {
    return parseAnalyticsConsent(
      window.localStorage.getItem(CONSENT_STORAGE_KEY),
    );
  } catch {
    // Private browsing / blocked storage — treat as undecided, stay denied.
    return null;
  }
}

/**
 * Mirror the banner choice into a first-party cookie so request-scoped server
 * code (auth, invite, answer, reveal) can honor the same grant without a DB
 * consent table. Same key/value as localStorage; no new vendors or wording.
 */
export function writeConsentCookie(choice: ConsentChoice): void {
  if (typeof document === "undefined") return;
  try {
    const maxAge = 60 * 60 * 24 * 400;
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${CONSENT_STORAGE_KEY}=${choice}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  } catch {
    // Non-fatal: server MP simply treats consent as unknown.
  }
}

export function storeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Non-fatal: the visitor simply gets asked again next visit.
  }
  writeConsentCookie(choice);
}

/** Browser event so Analytics can inject GTM in the same page view as Accept. */
export const CONSENT_CHANGE_EVENT = "rc-analytics-consent";

/** Notify listeners (Analytics) that stored consent changed. */
export function notifyConsentChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

/**
 * GTM must not load until analytics consent is granted. Consent Mode
 * "advanced" (load tags while denied) sends cookieless pings that contradict
 * the privacy policy — we use basic: no gtm.js until Accept.
 */
export function shouldLoadGtm(
  pathname: string,
  consent: ConsentChoice | null,
): boolean {
  return isMeasurablePath(pathname) && consent === "granted";
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Push `questions_cta_click` to the dataLayer when the visitor is on a
 * measurable path and has granted analytics consent. No-ops otherwise so we
 * never measure behind auth or without consent.
 */
export function pushQuestionsCtaClick(page: string): void {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname || "/";
  if (!isMeasurablePath(pathname)) return;
  if (readStoredConsent() !== "granted") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: "questions_cta_click", page });
}
