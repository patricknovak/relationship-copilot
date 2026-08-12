"use client";

import { useEffect, useState, useTransition } from "react";
import { sendEmailInvite } from "@/app/actions/connections";
import { buildInviteMessage, smsHref, whatsappHref } from "@/lib/invite";

// The one place an inviter gets their person in: email an invite (creates the
// account and signs them in from the email itself), text/share the link, or
// copy it. Replaces the old copy-only InviteShare.
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
          text: "Invitation sent ✨ One tap on the email signs them in and connects you.",
        });
      } else {
        setNotice({
          tone: "info",
          text: "They already have an account — text or share the link below and they'll join in one tap.",
        });
      }
    });
  }

  async function share() {
    try {
      await navigator.share({ title: "Relationship Copilot", text: message, url });
    } catch {
      /* user dismissed the share sheet */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <form onSubmit={submitEmail} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="their@email.com"
          aria-label="Their email address"
          className="input flex-1"
        />
        <button disabled={sending} className="btn-primary shrink-0 disabled:opacity-60">
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

      <div className="flex flex-wrap items-center gap-2">
        <a href={smsHref(message)} className="btn-secondary">
          💬 Text it
        </a>
        <a
          href={whatsappHref(message)}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          WhatsApp
        </a>
        {canShare && (
          <button onClick={share} className="btn-secondary">
            Share…
          </button>
        )}
        <button onClick={copy} className="btn-secondary">
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>

      <p className="text-xs text-ink-soft/60">
        The link works once — whoever taps it first becomes your person here.
      </p>
    </div>
  );
}
