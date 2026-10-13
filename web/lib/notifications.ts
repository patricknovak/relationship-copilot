// Pure, framework-free pieces of the notification system: preference parsing,
// email copy, and the unsubscribe token. Nothing here reads the database or
// sends anything. Invariant: no email ever contains answer text, a partner's
// private state beyond "they've answered", or a relationship type.

import { createHmac, timingSafeEqual } from "node:crypto";

export type NotificationKind = "your_turn" | "revealed" | "daily_ready";

export interface NotificationPrefs {
  your_turn: boolean; // they answered; it's your move
  revealed: boolean; // you both answered; the reveal is ready
  daily_ready: boolean; // today's question is waiting (opt-in; one a day)
}

// Defaults: the two event-driven emails on, the daily reminder off. A pair
// that answers daily gets at most two emails a day from the loop; the
// category's own review data says 1–3 a week is the sweet spot, so the daily
// reminder is opt-in.
export const DEFAULT_PREFS: NotificationPrefs = {
  your_turn: true,
  revealed: true,
  daily_ready: false,
};

export const PREF_LABELS: Record<
  NotificationKind,
  { label: string; detail: string }
> = {
  your_turn: {
    label: "They answered — your turn",
    detail: "When the other person has answered a question you haven't yet.",
  },
  revealed: {
    label: "You both answered",
    detail: "When a reveal unlocks, so you can read it side by side.",
  },
  daily_ready: {
    label: "Today's question is ready",
    detail: "A daily reminder with the question, for each active connection.",
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
  const pick = (k: NotificationKind) =>
    typeof n[k] === "boolean" ? (n[k] as boolean) : DEFAULT_PREFS[k];
  return {
    your_turn: pick("your_turn"),
    revealed: pick("revealed"),
    daily_ready: pick("daily_ready"),
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
    case "daily_ready":
    default:
      subject = "Today's question is ready";
      lead = `A new question is waiting for you and ${who}. Answer in private; it reveals when you both have.`;
      cta = "Answer today's question";
      break;
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
