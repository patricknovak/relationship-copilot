"use client";

import { useFormStatus } from "react-dom";

// Submit button for server-action forms: disables and relabels while the
// action runs, so slow actions give feedback and double-submits can't happen.
export default function PendingButton({
  children,
  pendingLabel = "Working…",
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
