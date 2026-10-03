import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeAuthNextParam,
  parseConfirmOtpType,
} from "@/lib/authConfirm";

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

  if (explicitNext) return NextResponse.redirect(`${origin}${explicitNext}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.display_name) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }
  return NextResponse.redirect(`${origin}/connections`);
}
