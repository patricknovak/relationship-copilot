"use client";

import { useState } from "react";
import ShareSheet from "@/components/ShareSheet";
import { Icon } from "@/components/ui/Icon";
import { publicShareTargets } from "@/lib/share";

// Share a public page (a question list, a library read) to messaging apps
// and social networks. Only the page URL and its title go out.
export default function SharePublic({
  url,
  text,
  label = "Share this",
}: {
  url: string;
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        <Icon name="share" className="h-4 w-4" />
        {label}
      </button>
    );
  }
  return (
    <div className="card animate-pop !p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg text-ink">{label}</p>
        <button type="button" onClick={() => setOpen(false)} className="btn-icon" aria-label="Close">
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3">
        <ShareSheet url={url} text={text} targets={publicShareTargets({ url, text })} />
      </div>
    </div>
  );
}
