"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

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
    <div className="hero-glow relative overflow-hidden">
      <div className="blob -left-20 top-10 h-72 w-72 bg-accent-200/50 dark:bg-accent-900/20" />
      <div className="blob -right-16 bottom-0 h-72 w-72 bg-brand-200/50 dark:bg-brand-900/25" />
      <div className="relative mx-auto max-w-md px-4 py-24 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-surface text-brand-700 shadow-lift dark:text-brand-200">
          <Icon name="lifebuoy" className="h-8 w-8" />
        </span>
        <h1 className="mt-6 text-display-md">Something went sideways</h1>
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
        <p className="mt-8 text-xs text-ink-faint">
          In crisis?{" "}
          <Link href="/safety" className="link">
            Safety resources
          </Link>{" "}
          are always free.
        </p>
      </div>
    </div>
  );
}
