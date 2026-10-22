import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthNextParam } from "@/lib/authConfirm";
import { SIGN_UP_COMPLETED } from "@/lib/ga4";
import { claimAndTrackUserFunnelStep } from "@/lib/funnelTrack";
import { resolvePostAuthDestination } from "@/lib/resolvePostAuthDestination";

// Establishes a session from either auth flow, then sends the user on:
// - `code`       — PKCE exchange (magic link / OAuth started in this browser)
// - `token_hash` — server-side OTP verification (admin invite emails, or any
//                  email template pointed at this route; works without the
//                  PKCE verifier cookie, which invite clicks never have)
// Prefer /auth/confirm for cross-device magic-link / signup emails — that
// path is verifyOtp-only and does not rely on a PKCE cookie.
// `next` is attacker-influenceable (it round-trips through email), so it is
// validated to a same-origin path before redirecting. An explicit `next`
// (e.g. an invite deep link) wins even for brand-new users — the invite page
// finishes the join, and profile onboarding can happen afterwards. Templates
// may hand us an absolute {{ .RedirectTo }} URL, so a same-origin prefix is
// stripped before validation.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const explicitNext = normalizeAuthNextParam(
    searchParams.get("next"),
    origin,
  );

  const supabase = await createClient();
  let authed = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authed = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    authed = !error;
  }
  if (!authed) {
    // Keep the destination (e.g. an invite deep link) through the failure so
    // a fresh sign-in still lands where the user was headed.
    const carry = explicitNext ? `&next=${encodeURIComponent(explicitNext)}` : "";
    return NextResponse.redirect(`${origin}/login?error=auth${carry}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Once-only anonymous GA4 sign_up_completed (0041). Failures never block redirect.
  if (user) {
    await claimAndTrackUserFunnelStep(supabase, SIGN_UP_COMPLETED, user.id);
  }

  if (explicitNext) return NextResponse.redirect(`${origin}${explicitNext}`);

  // No explicit destination: incomplete profile → onboarding; no partner yet
  // → invite step (/connections/new or existing solo invite). Explicit invite
  // deep links still win above.
  if (user) {
    const dest = await resolvePostAuthDestination(supabase, user.id);
    return NextResponse.redirect(`${origin}${dest}`);
  }
  return NextResponse.redirect(`${origin}/connections`);
}
