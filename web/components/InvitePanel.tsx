"use client";

import { useEffect, useState, useTransition } from "react";
import { markInviteShared, sendEmailInvite } from "@/app/actions/connections";
import { buildInviteMessage, smsHref, whatsappHref } from "@/lib/invite";

// The one place an inviter gets their person in: text/share the link first
// (proven path), with email invite as a secondary option until deliverability
// is confirmed. Replaces the old copy-only InviteShare.
export default function InvitePanel({
  connectionId,
  url,
  inviterName,
}: {
  connectionId: string;
  url: string;
  inviterName: string | null;
}) {
  const [email, setEmail] = useState("");
  const [sending, startSending] = useTransition();
  const [notice, setNotice] = useState<{
    tone: "ok" | "info" | "error";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const message = buildInviteMessage(inviterName, url);

  // Fire-and-forget funnel mark — never blocks or changes the share UI.
  function noteShared() {
    void markInviteShared(connectionId);
  }

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    startSending(async () => {
      const result = await sendEmailInvite(connectionId, email);
      if ("error" in result) {
        setNotice({ tone: "error", text: result.error });
      } else if (result.status === "sent") {
        setEmail("");
        setNotice({
          tone: "ok",
          text: "Invitation sent. If it's not in their inbox in a few minutes, ask them to check spam — or text them the link instead.",
        });
      } else {
        setNotice({
          tone: "info",
          text: "They already have an account — text or share the link instead, and they'll join when they open it.",
        });
      }
    });
  }

  async function share() {
    try {
      await navigator.share({ title: "Relationship Copilot", text: message, url });
      noteShared();
    } catch {
      /* user dismissed the share sheet */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      noteShared();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — fall back to selecting the URL via the sms path */
      setNotice({
        tone: "info",
        text: "Couldn't copy automatically — tap Text it or WhatsApp instead.",
      });
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={smsHref(message)}
          className="btn-primary"
          onClick={noteShared}
        >
          Text it
        </a>
        {canShare ? (
          <button onClick={share} className="btn-primary">
            Share…
          </button>
        ) : null}
        <a
          href={whatsappHref(message)}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
          onClick={noteShared}
        >
          WhatsApp
        </a>
        <button onClick={copy} className="btn-secondary">
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>

      <form
        onSubmit={submitEmail}
        className="flex min-w-0 flex-col gap-2 sm:flex-row"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="their@email.com"
          aria-label="Their email address"
          className="input min-w-0 flex-1"
        />
        <button
          disabled={sending}
          className="btn-secondary w-full disabled:opacity-60 sm:w-auto sm:shrink-0"
        >
          {sending ? "Sending…" : "Email invite"}
        </button>
      </form>

      {notice && (
        <p
          className={`text-sm ${
            notice.tone === "error"
              ? "text-rose-600"
              : notice.tone === "ok"
                ? "text-brand-700 dark:text-brand-300"
                : "text-ink-soft"
          }`}
        >
          {notice.text}
        </p>
      )}

      <p className="text-xs text-ink-soft/60">
        The link works once — whoever taps it first becomes your person here.
      </p>
    </div>
  );
}
