"use client";

import { useState, useTransition } from "react";
import { signInVia } from "@/lib/signInCopy";
import { markInviteShared, sendEmailInvite } from "@/app/actions/connections";
import { buildInviteMessage } from "@/lib/invite";
import { inviteShareTargets } from "@/lib/share";
import ShareSheet from "@/components/ShareSheet";
import { Icon } from "@/components/ui/Icon";

// The one place an inviter gets their person in: the share sheet (native
// share, copy, Messages, WhatsApp, Telegram, email) plus an emailed invite we
// send ourselves. Private invite links never get social-network buttons —
// the link works once, so whoever opens it first becomes the other person.
export default function InvitePanel({
  connectionId,
  url,
  inviterName,
  note = null,
  inviterAnswered = false,
}: {
  connectionId: string;
  url: string;
  inviterName: string | null;
  /** The inviter's optional personal note (migration 0035). */
  note?: string | null;
  /** The inviter already answered the first questions (answer-first). */
  inviterAnswered?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [sending, startSending] = useTransition();
  const [notice, setNotice] = useState<{
    tone: "ok" | "info" | "error";
    text: string;
  } | null>(null);

  const message = buildInviteMessage(inviterName, url, { inviterAnswered, note });
  const subject = inviterName
    ? `${inviterName} invited you to Relationship Copilot`
    : "Join me on Relationship Copilot";

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
          text: "Invitation sent. If it's not in their inbox in a few minutes, ask them to check spam — or share the link instead.",
        });
      } else {
        setNotice({
          tone: "info",
          text: "They already have an account — share the link instead, and they'll join when they open it.",
        });
      }
    });
  }

  return (
    <div className="mt-4 space-y-5">
      <ShareSheet
        url={url}
        text={message}
        targets={inviteShareTargets({ url, message, subject })}
        primaryLabel="Share invite link"
        onShared={noteShared}
      />

      <div className="rounded-2xl border border-surface-line bg-surface/70 p-3.5 dark:bg-surface-raised/60">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Icon name="mail" className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          Or let us email the invite
        </p>
        <form
          onSubmit={submitEmail}
          className="mt-2.5 flex min-w-0 flex-col gap-2 sm:flex-row"
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
            role="status"
            className={`mt-2 text-sm ${
              notice.tone === "error"
                ? "text-rose-600"
                : notice.tone === "ok"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-ink-soft"
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-ink-faint">
        <Icon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        The link works once — whoever opens it first becomes your person here.
        That&apos;s why it belongs in a message, not a public post. They sign in
        with {signInVia()}.
      </p>
    </div>
  );
}
