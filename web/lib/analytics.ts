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

export function readStoredConsent(): ConsentChoice | null {
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    // Private browsing / blocked storage — treat as undecided, stay denied.
    return null;
  }
}

export function storeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Non-fatal: the visitor simply gets asked again next visit.
  }
}
