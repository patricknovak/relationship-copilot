"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseAuthFragment } from "@/lib/authFragment";

// Invite emails sent via the admin API sign the recipient in through the
// implicit flow: Supabase's verify endpoint redirects here with tokens in the
// URL fragment, which no server code can see and which the PKCE-configured
// browser client ignores. This consumes them: set the session (persisted to
// cookies), scrub the hash from the address bar/history, and refresh so the
// server re-renders this page signed-in — on the invite page that means the
// auto-join takes over. No-op when there is no auth fragment.
export default function AuthFragmentSession() {
  const consumed = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    const tokens = parseAuthFragment(window.location.hash);
    if (!tokens) return;

    const supabase = createClient();
    supabase.auth.setSession(tokens).then(({ error }) => {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      if (!error) router.refresh();
    });
  }, [router]);

  return null;
}
