import { safeNextPath } from "@/lib/redirect";

// Shown when /auth/confirm or /auth/callback fails (cross-device PKCE miss,
// already-used link, etc.). Kept out of app/login/page.tsx so Next.js does
// not treat it as an invalid Page export.
export const AUTH_LINK_FAILED_MESSAGE =
  "That sign-in link didn't work. It must be opened on the same device and browser that requested it, or it may already have been used. Request a fresh one below.";

// OTP email types accepted by /auth/confirm. Cross-device magic links and
// signup confirmation use token_hash + verifyOtp (no PKCE cookie required).
export const CONFIRM_OTP_TYPES = ["magiclink", "signup", "email"] as const;
export type ConfirmOtpType = (typeof CONFIRM_OTP_TYPES)[number];

export function parseConfirmOtpType(
  type: string | null | undefined,
): ConfirmOtpType | null {
  if (!type) return null;
  return (CONFIRM_OTP_TYPES as readonly string[]).includes(type)
    ? (type as ConfirmOtpType)
    : null;
}

// Routes that only establish a session. They are never a destination: sent
// there without a fresh code or token they fail to /login?error=auth.
const AUTH_ROUTES = new Set(["/auth/callback", "/auth/confirm"]);

// Email templates may hand an absolute {{ .RedirectTo }} / next URL. Strip a
// same-origin prefix so safeNextPath can validate the remaining path. Returns
// "" when missing or unsafe — callers treat that as "no explicit next".
//
// {{ .RedirectTo }} is whatever the login form passed as emailRedirectTo,
// which is our own /auth/callback?next=<destination>. A template that
// forwards it (…/auth/confirm?token_hash=…&next={{ .RedirectTo }}) therefore
// hands us the callback route wrapped around the real destination. Unwrap it
// here; otherwise a signed-in user is bounced through the callback with no
// code, shown as a failed link, and loses the new-user onboarding step.
export function normalizeAuthNextParam(
  rawNext: string | null | undefined,
  origin: string,
): string {
  let next = rawNext;
  // Bounded: a destination is at most a couple of wrappers deep.
  for (let depth = 0; depth < 3; depth++) {
    if (!next) return "";
    if (origin && next.startsWith(`${origin}/`)) {
      next = next.slice(origin.length);
    }
    const safe = safeNextPath(next, "");
    if (!safe) return "";
    const queryAt = safe.search(/[?#]/);
    const path = queryAt === -1 ? safe : safe.slice(0, queryAt);
    if (!AUTH_ROUTES.has(path)) return safe;
    const query =
      queryAt !== -1 && safe[queryAt] === "?"
        ? safe.slice(queryAt + 1).split("#", 1)[0]
        : "";
    next = new URLSearchParams(query).get("next");
  }
  return "";
}
