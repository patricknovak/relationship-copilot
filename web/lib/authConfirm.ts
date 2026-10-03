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

// Email templates may hand an absolute {{ .RedirectTo }} / next URL. Strip a
// same-origin prefix so safeNextPath can validate the remaining path. Returns
// "" when missing or unsafe — callers treat that as "no explicit next".
export function normalizeAuthNextParam(
  rawNext: string | null | undefined,
  origin: string,
): string {
  if (!rawNext) return "";
  let next = rawNext;
  if (origin && next.startsWith(`${origin}/`)) {
    next = next.slice(origin.length);
  }
  return safeNextPath(next, "");
}
