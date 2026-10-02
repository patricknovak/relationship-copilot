"use client";

import { useEffect, useState } from "react";
import {
  nudgeFinishMessage,
  nudgeStartMessage,
  WAITING_ON_THEM,
  BOTH_JOINED,
} from "@/lib/firstRevealCopy";

// Opens the native share sheet (or copies) so you can nudge your person —
// never exposes answer content. variant "finish" = waiting on them after you
// answered; "start" = both joined, neither has answered yet.
export default function NudgePerson({
  connectionUrl,
  inviterName,
  variant = "finish",
}: {
  connectionUrl: string;
  inviterName: string | null;
  variant?: "start" | "finish";
}) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const message =
    variant === "start"
      ? nudgeStartMessage(connectionUrl)
      : nudgeFinishMessage(inviterName, connectionUrl);

  const label =
    variant === "start" ? BOTH_JOINED.secondaryCta : WAITING_ON_THEM.primaryCta;

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
    <button
      type="button"
      onClick={nudge}
      className={variant === "start" ? "btn-secondary" : "btn-primary"}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
