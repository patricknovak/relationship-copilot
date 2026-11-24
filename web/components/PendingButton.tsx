"use client";

import { useFormStatus } from "react-dom";

// Submit button for server-action forms: disables and relabels while the
// action runs, so slow actions give feedback and double-submits can't happen.
export default function PendingButton({
  children,
  pendingLabel = "Working…",
  className = "btn-primary",
  ariaLabel,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  /** Accessible name for icon-only buttons. */
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} aria-label={ariaLabel} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
