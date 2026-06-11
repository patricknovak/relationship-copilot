"use client";

import { useState } from "react";

export default function InviteShare({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the input is still selectable */
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="input flex-1 !font-mono"
      />
      <button
        onClick={copy}
        className="btn-primary"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
