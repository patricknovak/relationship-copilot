import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/lib/database.types";

async function newClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          // In server components cookie mutation throws; middleware refreshes
          // the session instead, so this is safe to swallow there.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* called from a server component — ignore */
          }
        },
      },
    },
  );
}

// Request-scoped Supabase client for server components, route handlers, and
// server actions. Uses the user's session cookies, so RLS applies as that user.
//
// React's cache() gives one client per server render, so a page and the
// server components under it share it. Outside a render (server actions,
// route handlers) cache() is a pass-through and each call builds a client,
// as before.
export const createClient = cache(newClient);

// The signed-in user, verified with Supabase Auth (auth.getUser(), a network
// round trip), once per server render however many components ask. The hub
// used to make that trip three times: the page, WeeklyDigest and LookingBack.
// Server actions and route handlers keep calling supabase.auth.getUser()
// themselves: they must not reuse a render's answer.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
