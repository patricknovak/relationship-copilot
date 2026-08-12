import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";

// Establishes a session from either auth flow, then sends the user on:
// - `code`       — PKCE exchange (magic link / OAuth started in this browser)
// - `token_hash` — server-side OTP verification (admin invite emails, or any
//                  email template pointed at this route; works without the
//                  PKCE verifier cookie, which invite clicks never have)
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

  let rawNext = searchParams.get("next");
  if (rawNext?.startsWith(`${origin}/`)) rawNext = rawNext.slice(origin.length);
  const explicitNext = rawNext ? safeNextPath(rawNext, "") : "";

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
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (explicitNext) return NextResponse.redirect(`${origin}${explicitNext}`);

  // No explicit destination: send users with an incomplete profile to set it
  // up first, everyone else to their connections.
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
