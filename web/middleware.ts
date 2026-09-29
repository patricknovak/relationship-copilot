import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildSecurityHeaders } from "@/lib/securityHeaders";

function applySecurityHeaders(response: NextResponse): NextResponse {
  // Report-Only until a preview confirms GTM + Turnstile without violations.
  // Flip cspMode to "enforce" in a follow-up once Patrick is satisfied.
  const headers = buildSecurityHeaders({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    cspMode: "report-only",
  });
  for (const { key, value } of headers) {
    response.headers.set(key, value);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    // Run on everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
