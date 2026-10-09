// Pure invite-landing discriminant + copy. Framework-free for vitest.
//
// Lookup outcomes (after format check + DB reads):
//   invalid  — malformed code, or well-formed code never issued / regenerated
//   used     — code was burned on accept (retired_invite_codes.reason = 'used')
//   expired  — row still has the code but invite_expires_at is past
//   ok       — open invite
//
// A malformed or unknown code must never surface as "already used".

import { isInviteCodeFormat } from "@/lib/invite";

export type InviteFailureStatus = "invalid" | "used" | "expired";

export type InviteLookupInput = {
  code: string;
  /** True when connections.invite_code matches. */
  foundActive: boolean;
  /** When foundActive, whether invite_expires_at <= now. */
  expired: boolean;
  /** True when retired_invite_codes has this code with reason 'used'. */
  retiredAsUsed: boolean;
};

export function classifyInviteLookup(
  input: InviteLookupInput,
): InviteFailureStatus | "ok" {
  if (!isInviteCodeFormat(input.code)) return "invalid";
  if (input.foundActive) return input.expired ? "expired" : "ok";
  if (input.retiredAsUsed) return "used";
  return "invalid";
}

export type InviteFailureCopy = {
  title: string;
  body: string;
  /** Primary guidance — always shown. */
  askPartner: string;
  /** Secondary CTA label when signed out. */
  startOwnLabel: string;
  /** Secondary CTA label when signed in. */
  connectionsLabel: string;
};

export const INVITE_FAILURE_COPY: Record<
  InviteFailureStatus,
  InviteFailureCopy
> = {
  invalid: {
    title: "This invite link isn't valid",
    body: "We couldn't find an open invite for that link.",
    askPartner: "Ask your partner to send a new link.",
    startOwnLabel: "Start your own connection",
    connectionsLabel: "Go to my connections",
  },
  used: {
    title: "This invite has already been used",
    body: "Invite links work once.",
    askPartner: "Ask your partner to send a new link.",
    startOwnLabel: "Start your own connection",
    connectionsLabel: "Go to my connections",
  },
  expired: {
    title: "This invite has expired",
    body: "Invite links work for a limited time.",
    askPartner: "Ask your partner to send a new link.",
    startOwnLabel: "Start your own connection",
    connectionsLabel: "Go to my connections",
  },
};

/** Extract an invite code from a validated next path like `/invite/ABC12345`. */
export function inviteCodeFromNext(
  next: string | null | undefined,
): string | null {
  if (!next) return null;
  const match = /^\/invite\/([^/?#]+)/i.exec(next);
  if (!match) return null;
  const code = decodeURIComponent(match[1] ?? "");
  return isInviteCodeFormat(code) ? code.toUpperCase() : null;
}

export type LoginIntent =
  | { kind: "invitee"; inviteCode: string }
  | { kind: "inviter" }
  | { kind: "generic" };

/** Classify post-login intent from a safe next path. */
export function loginIntentFromNext(
  next: string | null | undefined,
): LoginIntent {
  if (!next) return { kind: "generic" };
  const code = inviteCodeFromNext(next);
  if (code) return { kind: "invitee", inviteCode: code };
  if (next === "/connections/new" || next.startsWith("/connections/new?")) {
    return { kind: "inviter" };
  }
  return { kind: "generic" };
}

export function loginHeadline(intent: LoginIntent, inviterName: string | null): string {
  if (intent.kind === "invitee") {
    return inviterName ? `${inviterName} invited you` : "You're invited";
  }
  if (intent.kind === "inviter") return "Sign in to invite your person";
  return "Welcome";
}

export function loginSubhead(intent: LoginIntent, inviterName: string | null): string {
  if (intent.kind === "invitee") {
    return inviterName
      ? `Sign in to join ${inviterName} — you'll land right back on your invitation and join automatically.`
      : "Sign in to join — you'll land right back on your invitation and join automatically.";
  }
  if (intent.kind === "inviter") {
    return "After you sign in, you'll create a connection and get a link to share.";
  }
  return "Sign in or create your free account — same door for both.";
}
