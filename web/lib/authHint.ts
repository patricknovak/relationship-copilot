// A *display* hint for "is someone signed in on this browser?", so public
// pages can be prerendered (static HTML from Workers Static Assets) and still
// show the right nav and CTAs without a flash.
//
// It only looks for the presence of the Supabase SSR session cookie
// (`sb-<project-ref>-auth-token`, possibly chunked as `.0`, `.1`, …). It is
// NOT authentication: every protected route still verifies the session on the
// server (proxy.ts + RLS). A stale cookie at worst shows "Account" to someone
// whose next click lands on the sign-in page.

export const SESSION_COOKIE_RE = /(?:^|;\s*)sb-[a-z0-9]+-auth-token(?:\.\d+)?=[^;]+/;

export function hasSessionCookie(cookieHeader: string | null | undefined): boolean {
  return !!cookieHeader && SESSION_COOKIE_RE.test(cookieHeader);
}

// Inlined in <head> as a blocking script (same pattern as ThemeScript), so the
// attribute is set before first paint. Kept tiny and dependency-free.
export const AUTH_HINT_SCRIPT =
  "(function(){try{if(" +
  SESSION_COOKIE_RE.toString() +
  ".test(document.cookie))document.documentElement.setAttribute('data-auth','in');}catch(e){}})();";
