"use client";

import { useState } from "react";
import ShareSheet from "@/components/ShareSheet";
import { Icon } from "@/components/ui/Icon";
import { milestoneShareText, publicShareTargets } from "@/lib/share";
import { CANONICAL_ORIGIN } from "@/lib/site";

// "Share the moment" after a reveal: a line about the milestone plus the
// public site link. Never the answers, never names, never a connection or
// invite id — so it is safe for messaging apps and social networks alike.
export default function ShareMilestone({
  kind,
  count,
  streak,
}: {
  kind: "first_reveal" | "reveal";
  count?: number;
  streak?: number;
}) {
  const [open, setOpen] = useState(false);
  const text = milestoneShareText(kind, { count, streak });
  const url = CANONICAL_ORIGIN;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn-sm">
        <Icon name="share" className="h-4 w-4" />
        Share the moment
      </button>
    );
  }

  return (
    <div className="card mt-4 animate-pop !p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg text-ink">Share the moment</p>
          <p className="mt-1 text-sm text-ink-soft">
            Only this line and a link to the site go out. Your answers and
            your person&apos;s name never leave the page.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="btn-icon" aria-label="Close">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 rounded-xl bg-paper-warm px-3 py-2 text-sm italic text-ink-soft">
        &ldquo;{text}&rdquo;
      </p>
      <div className="mt-4">
        <ShareSheet url={url} text={text} targets={publicShareTargets({ url, text })} />
      </div>
    </div>
  );
}
