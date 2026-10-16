import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/redirect";

// Routes that require a signed-in user. Everything else (landing, login,
// /safety, /library, the invite landing) is public — safety resources must
// always be reachable, and the library is part of the free public promise.
const PROTECTED_PREFIXES = ["/onboarding", "/connections", "/account"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token and keeps cookies in sync. Do not run code
  // between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && needsAuth) {
    // Keep the full path *and* query in `next` (e.g. /connections/new?type=
    // sibling from the /for pages), and nothing else on /login itself.
    const url = request.nextUrl.clone();
    const next = `${pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  // Already signed in? /login has nothing to offer — forward to the intended
  // destination (e.g. an invite deep link) or the connections home. Use the
  // same open-redirect guard as auth callbacks and the login page.
  if (user && pathname === "/login") {
    const target = safeNextPath(
      request.nextUrl.searchParams.get("next"),
      "/connections",
    );
    const url = request.nextUrl.clone();
    url.search = "";
    const [pathOnly, query = ""] = target.split("?", 2);
    url.pathname = pathOnly;
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  }

  return response;
}
