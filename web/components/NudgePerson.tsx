"use client";

import { useEffect, useState } from "react";
import { WAITING_ON_THEM } from "@/lib/firstRevealCopy";

// Opens the native share sheet (or copies) so you can nudge your person to
// finish their private answers — never exposes answer content.
export default function NudgePerson({
  connectionUrl,
  inviterName,
}: {
  connectionUrl: string;
  inviterName: string | null;
}) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const who = inviterName?.trim() || "I";
  const message = `${who === "I" ? "I've" : `${who} has`} answered on Relationship Copilot — when you're ready, finish yours so we can reveal together. No peeking either way.\n\n${connectionUrl}`;

  async function nudge() {
    if (canShare) {
      try {
        await navigator.share({
          title: "Relationship Copilot",
          text: message,
          url: connectionUrl,
        });
        return;
      } catch {
        /* dismissed or unavailable — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button type="button" onClick={nudge} className="btn-primary">
      {copied ? "Copied ✓" : WAITING_ON_THEM.primaryCta}
    </button>
  );
}
