// Pure, framework-free pieces of the notification system: preference parsing,
// email copy, and the unsubscribe token. Nothing here reads the database or
// sends anything. Invariant: no email ever contains answer text, a partner's
// private state beyond "they've answered", or a relationship type.

import { createHmac, timingSafeEqual } from "node:crypto";

export type NotificationKind =
  | "your_turn"
  | "revealed"
  | "daily_ready"
  | "partner_joined"
  | "discussion_reply"
  | "turn_reminder";

// Which preference switch governs each kind. partner_joined rides on
// your_turn: both mean "they moved, it's your move".
export const PREF_FOR_KIND: Record<NotificationKind, keyof NotificationPrefs> = {
  your_turn: "your_turn",
  revealed: "revealed",
  daily_ready: "daily_ready",
  partner_joined: "your_turn",
  discussion_reply: "discussion_reply",
  turn_reminder: "your_turn",
};

export interface NotificationPrefs {
  your_turn: boolean; // they answered; it's your move
  revealed: boolean; // you both answered; the reveal is ready
  daily_ready: boolean; // today's question is waiting (opt-in; one a day)
  discussion_reply: boolean; // they wrote in a discussion (first reply per reveal)
}

// Defaults: the two event-driven emails on, the daily reminder off. A pair
// that answers daily gets at most two emails a day from the loop; the
// category's own review data says 1–3 a week is the sweet spot, so the daily
// reminder is opt-in.
export const DEFAULT_PREFS: NotificationPrefs = {
  your_turn: true,
  revealed: true,
  daily_ready: false,
  discussion_reply: true,
};

export const PREF_LABELS: Record<
  keyof NotificationPrefs,
  { label: string; detail: string }
> = {
  your_turn: {
    label: "They joined or answered — your turn",
    detail: "When the person you invited joins, and when they've answered a question you haven't yet.",
  },
  revealed: {
    label: "You both answered",
    detail: "When a reveal unlocks, so you can read it side by side.",
  },
  daily_ready: {
    label: "Today's question is ready",
    detail: "A daily reminder with the question, for each active connection.",
  },
  discussion_reply: {
    label: "They wrote in a discussion",
    detail: "The first time the other person replies under a reveal (never the message itself).",
  },
};

// profiles.preferences is a free-form JSON blob; notifications live under
// one key so other preferences can share the column.
export function parseNotificationPrefs(preferences: unknown): NotificationPrefs {
  const root =
    preferences && typeof preferences === "object"
      ? (preferences as Record<string, unknown>)
      : {};
  const n =
    root.notifications && typeof root.notifications === "object"
      ? (root.notifications as Record<string, unknown>)
      : {};
  const pick = (k: keyof NotificationPrefs) =>
    typeof n[k] === "boolean" ? (n[k] as boolean) : DEFAULT_PREFS[k];
  return {
    your_turn: pick("your_turn"),
    revealed: pick("revealed"),
    daily_ready: pick("daily_ready"),
    discussion_reply: pick("discussion_reply"),
  };
}

// Merge new notification prefs into the existing preferences blob without
// clobbering unrelated keys.
export function withNotificationPrefs(
  preferences: unknown,
  prefs: Partial<NotificationPrefs>,
): Record<string, unknown> {
  const root =
    preferences && typeof preferences === "object"
      ? { ...(preferences as Record<string, unknown>) }
      : {};
  const current = parseNotificationPrefs(root);
  root.notifications = { ...current, ...prefs };
  return root;
}

export const ALL_OFF: NotificationPrefs = {
  your_turn: false,
  revealed: false,
  daily_ready: false,
  discussion_reply: false,
};

// ---------------------------------------------------------------------------
// Email copy
// ---------------------------------------------------------------------------

export interface NotificationEmailInput {
  kind: NotificationKind;
  // The other person's first name, or null → "your person".
  themName: string | null;
  // Template text for daily_ready only (never an answer).
  questionText?: string | null;
  // Absolute links.
  instanceUrl: string;
  unsubscribeUrl: string;
}

export interface NotificationEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(name: string | null | undefined): string | null {
  const n = name?.trim();
  if (!n) return null;
  return n.split(/\s+/)[0].slice(0, 40);
}

export function buildNotificationEmail(
  input: NotificationEmailInput,
): NotificationEmail {
  const who = firstName(input.themName) ?? "Your person";
  let subject: string;
  let lead: string;
  let cta: string;
  switch (input.kind) {
    case "your_turn":
      subject = `${who} answered — your turn`;
      lead = `${who} has answered a question on Relationship Copilot. Their answer stays private until you share yours too — finish it to reveal both.`;
      cta = "Answer now";
      break;
    case "revealed":
      subject = `You and ${who} both answered`;
      lead = `You've both shared, so the reveal is open. Read the answers side by side and pick up the thread in the discussion.`;
      cta = "See the reveal";
      break;
    case "discussion_reply":
      subject = `${who} wrote something under your reveal`;
      lead = `${who} replied in the discussion under something you both answered on Relationship Copilot. Read it there and keep the thread going.`;
      cta = "Open the discussion";
      break;
    case "partner_joined":
      subject = `${who} joined — your first questions are ready`;
      lead = `${who} accepted your invite on Relationship Copilot. Your first questions are unlocked for you both: answer in private, and they reveal when you've both shared.`;
      cta = "Start answering";
      break;
    case "turn_reminder":
      subject = `${who} is still waiting on your answers`;
      lead = `${who} answered a while ago. Their answers stay private until you share yours, so whenever you're ready, finish yours to see both side by side. This is the only reminder we'll send for it.`;
      cta = "Finish your answers";
      break;
    case "daily_ready":
      subject = "Today's question is ready";
      lead = `A new question is waiting for you and ${who}. Answer in private; it reveals when you both have.`;
      cta = "Answer today's question";
      break;
    default: {
      // Exhaustive: a new NotificationKind must get its own email copy.
      const unhandled: never = input.kind;
      throw new Error(`no email copy for ${String(unhandled)}`);
    }
  }

  const question =
    input.kind === "daily_ready" && input.questionText?.trim()
      ? input.questionText.trim()
      : null;

  const text = [
    lead,
    question ? `\n“${question}”` : null,
    `\n${cta}: ${input.instanceUrl}`,
    "\nNo peeking either way: nobody's answer is shown until you've both shared.",
    `\nStop these emails: ${input.unsubscribeUrl}`,
  ]
    .filter((x): x is string => !!x)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#fbf8f4;color:#221a22;font-family:Georgia,'Times New Roman',serif;line-height:1.55">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f4;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e8ddd8;border-radius:16px;padding:32px 28px">
          <tr><td style="font-size:16px;color:#221a22">
            <p style="margin:0 0 20px">${escapeHtml(lead)}</p>
            ${
              question
                ? `<p style="margin:0 0 24px;font-size:20px;line-height:1.35;color:#221a22">&ldquo;${escapeHtml(question)}&rdquo;</p>`
                : ""
            }
            <p style="margin:0 0 24px;text-align:center">
              <a href="${escapeHtml(input.instanceUrl)}" style="display:inline-block;background:#74386f;color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;padding:12px 22px;border-radius:999px">${escapeHtml(cta)}</a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#6b5a66">No peeking either way: nobody&rsquo;s answer is shown until you&rsquo;ve both shared.</p>
            <p style="margin:0;font-size:12px;color:#8a7a85"><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#8a7a85">Stop these emails</a> &middot; Relationship Copilot</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Unsubscribe token: HMAC of the user id. No expiry — the link's only power
// is to turn notifications off for that user, which is never harmful.
// ---------------------------------------------------------------------------

export function unsubscribeToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("hex");
}

export function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string,
): boolean {
  if (!userId || !token || !secret) return false;
  const expected = Buffer.from(unsubscribeToken(userId, secret), "utf8");
  const given = Buffer.from(token, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(
  siteUrl: string,
  userId: string,
  secret: string,
): string {
  const u = new URL("/api/notifications/unsubscribe", siteUrl);
  u.searchParams.set("u", userId);
  u.searchParams.set("t", unsubscribeToken(userId, secret));
  return u.toString();
}

// ---------------------------------------------------------------------------
// Push copy. Lock screens are semi-public, so a push says even less than the
// email: a first name and a generic line, never answer text or the question.
// ---------------------------------------------------------------------------

export interface PushNotificationCopy {
  title: string;
  body: string;
  tag: string;
}

export function buildPushCopy(
  kind: NotificationKind,
  themName: string | null,
  instanceId: string,
): PushNotificationCopy {
  const who = firstName(themName) ?? "Your person";
  switch (kind) {
    case "your_turn":
      return { title: `${who} answered`, body: "Your turn. Answer to reveal both.", tag: `turn-${instanceId}` };
    case "revealed":
      return { title: "You both answered", body: "The reveal is open. Read it side by side.", tag: `reveal-${instanceId}` };
    case "discussion_reply":
      return { title: `${who} replied`, body: "They wrote under something you both answered.", tag: `reply-${instanceId}` };
    case "partner_joined":
      return { title: `${who} joined`, body: "Your first questions are ready.", tag: `joined-${instanceId}` };
    case "turn_reminder":
      // Same tag as your_turn, so the reminder replaces the first nudge.
      return { title: `${who} is still waiting`, body: "Answer when you have a minute. It reveals when you both have.", tag: `turn-${instanceId}` };
    case "daily_ready":
      return { title: "Today's question is ready", body: "Answer in private. It reveals when you both have.", tag: `daily-${instanceId}` };
    default: {
      // Exhaustive: a new NotificationKind must get its own push copy.
      const unhandled: never = kind;
      throw new Error(`no push copy for ${String(unhandled)}`);
    }
  }
}
