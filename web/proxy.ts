import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildSecurityHeaders } from "@/lib/securityHeaders";
import { createCspNonce, CSP_NONCE_HEADER } from "@/lib/cspNonce";

function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
): NextResponse {
  const headers = buildSecurityHeaders({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    cspMode: "enforce",
    nonce,
    isDev: process.env.NODE_ENV === "development",
  });
  for (const { key, value } of headers) {
    response.headers.set(key, value);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = createCspNonce();

  // Forward nonce + CSP on the request so Next.js can stamp framework
  // scripts and so root layout can read x-nonce for inline tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  const cspValue = buildSecurityHeaders({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    cspMode: "enforce",
    nonce,
    isDev: process.env.NODE_ENV === "development",
  }).find((h) => h.key === "Content-Security-Policy")!.value;
  requestHeaders.set("Content-Security-Policy", cspValue);

  const requestWithNonce = new NextRequest(request, {
    headers: requestHeaders,
  });

  const response = await updateSession(requestWithNonce);
  return applySecurityHeaders(response, nonce);
}

export const config = {
  matcher: [
    // Run on everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
