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
// auto-join takes over. No-op when there is no auth fragment, and never used
// to replace an existing session (see below).
export default function AuthFragmentSession() {
  const consumed = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    const tokens = parseAuthFragment(window.location.hash);
    if (!tokens) return;

    const supabase = createClient();
    const scrub = () =>
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    // Never replace a session that already exists. The fragment is just part
    // of a link, so anyone can build one carrying THEIR OWN tokens; without
    // this check, a signed-in person who opened such a link was silently
    // switched into the sender's account and would write private answers
    // there. A signed-in visitor keeps their account (the invite still
    // auto-joins for it); the tokens are dropped from the address bar.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        scrub();
        return;
      }
      supabase.auth.setSession(tokens).then(({ error }) => {
        scrub();
        if (!error) router.refresh();
      });
    });
  }, [router]);

  return null;
}
