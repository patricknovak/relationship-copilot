import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeAuthNextParam,
  parseConfirmOtpType,
} from "@/lib/authConfirm";
import { readRequestAnalyticsConsent } from "@/lib/analyticsConsent.server";
import { SIGN_UP_COMPLETED } from "@/lib/ga4";
import { claimAndTrackUserFunnelStep } from "@/lib/funnelTrack";
import { resolvePostAuthDestination } from "@/lib/resolvePostAuthDestination";

// Cross-device email OTP confirmation. Unlike /auth/callback (PKCE code
// exchange), this path uses token_hash + verifyOtp and does not need the
// PKCE verifier cookie — so the link works when opened on a different
// browser or device than the one that requested the email.
//
// Email templates should point here:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
// Optional `next` (or RedirectTo) is validated to a same-origin path.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const otpType = parseConfirmOtpType(searchParams.get("type"));
  const explicitNext = normalizeAuthNextParam(
    searchParams.get("next"),
    origin,
  );

  const fail = () => {
    const carry = explicitNext
      ? `&next=${encodeURIComponent(explicitNext)}`
      : "";
    return NextResponse.redirect(`${origin}/login?error=auth${carry}`);
  };

  if (!tokenHash || !otpType) return fail();

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: otpType,
    token_hash: tokenHash,
  });
  if (error) return fail();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Once-only anonymous GA4 sign_up_completed (0041). Failures never block redirect.
  // MP only when this request's analytics consent cookie is granted.
  if (user) {
    const analyticsConsent = await readRequestAnalyticsConsent();
    await claimAndTrackUserFunnelStep(
      supabase,
      SIGN_UP_COMPLETED,
      user.id,
      analyticsConsent,
    );
  }

  if (explicitNext) return NextResponse.redirect(`${origin}${explicitNext}`);

  if (user) {
    const dest = await resolvePostAuthDestination(supabase, user.id);
    return NextResponse.redirect(`${origin}${dest}`);
  }
  return NextResponse.redirect(`${origin}/connections`);
}
