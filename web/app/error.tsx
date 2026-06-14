"use client";

import Link from "next/link";
import { useEffect } from "react";

// Branded route-level error boundary. Keeps the user oriented (and pointed at
// safety) when something unexpected throws, instead of a blank crash.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in Vercel logs for triage; no PII beyond the message.
    console.error(error);
  }, [error]);

  return (
    <div className="hero-glow">
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-4xl">Something went sideways</h1>
        <p className="mt-3 text-ink-soft">
          A hiccup on our end — not you. Try again, and if it keeps happening
          you can always reach support resources below.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/connections" className="btn-secondary">
            Your connections
          </Link>
        </div>
        <p className="mt-8 text-xs text-ink-soft/70">
          In crisis?{" "}
          <Link href="/safety" className="underline">
            Safety resources
          </Link>{" "}
          are always free.
        </p>
      </div>
    </div>
  );
}
