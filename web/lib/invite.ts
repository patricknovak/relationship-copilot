// Pure helpers for the invite share flow: the message that goes out via
// text/share/WhatsApp, and the platform-quirky share hrefs. Kept framework-
// free and unit-tested.

export function buildInviteMessage(
  inviterName: string | null | undefined,
  url: string,
): string {
  const who = inviterName?.trim();
  const opener = who
    ? `${who} invited you to connect on Relationship Copilot.`
    : `Join me on Relationship Copilot.`;
  return `${opener} Answer questions together — neither of you sees the other's answer until you've both shared. Tap to join: ${url}`;
}

// The `?&body=` form is the one that works across both iOS and Android;
// iOS-only is `sms:&body=`, Android-only is `sms:?body=`.
export function smsHref(message: string): string {
  return `sms:?&body=${encodeURIComponent(message)}`;
}

export function whatsappHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
