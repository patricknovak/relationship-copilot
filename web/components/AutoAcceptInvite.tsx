"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { acceptInvite } from "@/app/actions/connections";

// Signed-in visitors on an invite page shouldn't have to click anything —
// arriving with the link IS the intent, so the join fires automatically (as a
// server action POST, so link prefetching can never trigger it). On success
// the action redirects into the connection; errors render inline.
export default function AutoAcceptInvite({ code }: { code: string }) {
  const fired = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function join() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(code);
      if (result?.error) setError(result.error);
    });
  }

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="mt-8">
        <p className="text-sm text-rose-600">{error}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={join} className="btn-secondary">
            Try again
          </button>
          <Link href="/connections" className="btn-ghost text-sm">
            My connections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 flex items-center justify-center gap-2 text-sm text-ink-soft">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-700" />
      Joining…
    </div>
  );
}
