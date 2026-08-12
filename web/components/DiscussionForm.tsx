"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postDiscussion } from "@/app/actions/prompts";

// Post-reveal chat composer: clears after sending (the old uncontrolled input
// kept the sent text, inviting duplicate sends), disables while in flight,
// and renders failures inline.
export default function DiscussionForm({
  instanceId,
  connectionId,
}: {
  instanceId: string;
  connectionId: string;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await postDiscussion({ instanceId, connectionId, body: text });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={send} className="mt-4">
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          placeholder="Share a thought…"
          aria-label="Message"
          className="input flex-1"
        />
        <button
          disabled={pending || !body.trim()}
          className="btn-primary shrink-0 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </form>
  );
}
