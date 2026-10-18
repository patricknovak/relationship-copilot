// Pure helpers for the invite share flow: the message that goes out via
// text/share/WhatsApp, and the platform-quirky share hrefs. Kept framework-
// free and unit-tested.

// Invite codes are uppercase alphanumeric (see newInviteCode in
// connections.ts). Accept either case so pasted/typed links still validate.
// New codes are 12 characters (migration 0040); links minted before that
// carry 8, and both must keep working.
export const INVITE_CODE_LENGTH = 12;
export function isInviteCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{8,12}$/i.test(code);
}

export function buildInviteMessage(
  inviterName: string | null | undefined,
  url: string,
  options: { inviterAnswered?: boolean; note?: string | null } = {},
): string {
  const who = inviterName?.trim();
  const opener = who
    ? `${who} invited you to connect on Relationship Copilot.`
    : `Join me on Relationship Copilot.`;
  const note = options.note?.trim() ? ` “${options.note.trim()}”` : "";
  const answered = options.inviterAnswered
    ? " I've already answered mine, so we can reveal as soon as you answer yours."
    : "";
  return `${opener}${note} We each answer the same questions in private, then reveal together — designed so neither of us sees the other's answers until we've both shared.${answered} It's free. Tap to join: ${url}`;
}

// The `?&body=` form is the one that works across both iOS and Android;
// iOS-only is `sms:&body=`, Android-only is `sms:?body=`.
export function smsHref(message: string): string {
  return `sms:?&body=${encodeURIComponent(message)}`;
}

export function whatsappHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
