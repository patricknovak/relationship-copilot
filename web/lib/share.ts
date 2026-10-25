// Share-link builders for messaging apps and social networks. Pure and
// unit-tested; the ShareSheet component renders them. Every builder takes the
// final text (and optionally the URL) so callers decide exactly what leaves
// the app — never answer content.

export type ShareChannel =
  | "native"
  | "copy"
  | "sms"
  | "whatsapp"
  | "telegram"
  | "email"
  | "x"
  | "facebook"
  | "linkedin"
  | "threads"
  | "reddit";

export interface ShareTarget {
  channel: ShareChannel;
  label: string;
  href: string;
}

const enc = encodeURIComponent;

// The `?&body=` form is the one that works across both iOS and Android.
export function smsShareHref(message: string): string {
  return `sms:?&body=${enc(message)}`;
}
export function whatsappShareHref(message: string): string {
  return `https://wa.me/?text=${enc(message)}`;
}
export function telegramShareHref(url: string, text: string): string {
  return `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`;
}
export function emailShareHref(subject: string, body: string): string {
  return `mailto:?subject=${enc(subject)}&body=${enc(body)}`;
}
export function xShareHref(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`;
}
export function facebookShareHref(url: string, quote?: string): string {
  const q = quote ? `&quote=${enc(quote)}` : "";
  return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}${q}`;
}
export function linkedinShareHref(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
}
export function threadsShareHref(text: string, url: string): string {
  return `https://www.threads.net/intent/post?text=${enc(`${text} ${url}`)}`;
}
export function redditShareHref(url: string, title: string): string {
  return `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`;
}

// Private invite links: messaging channels only. Posting an invite link
// publicly would let a stranger claim the connection (links work once).
export function inviteShareTargets(input: { url: string; message: string; subject: string }): ShareTarget[] {
  return [
    { channel: "sms", label: "Messages", href: smsShareHref(input.message) },
    { channel: "whatsapp", label: "WhatsApp", href: whatsappShareHref(input.message) },
    { channel: "telegram", label: "Telegram", href: telegramShareHref(input.url, input.message.replace(input.url, "").trim()) },
    { channel: "email", label: "Email", href: emailShareHref(input.subject, input.message) },
  ];
}

// Public pages and milestones: messaging plus social networks.
export function publicShareTargets(input: { url: string; text: string; subject?: string }): ShareTarget[] {
  const subject = input.subject ?? input.text;
  const withUrl = `${input.text} ${input.url}`;
  return [
    { channel: "sms", label: "Messages", href: smsShareHref(withUrl) },
    { channel: "whatsapp", label: "WhatsApp", href: whatsappShareHref(withUrl) },
    { channel: "telegram", label: "Telegram", href: telegramShareHref(input.url, input.text) },
    { channel: "x", label: "X", href: xShareHref(input.text, input.url) },
    { channel: "threads", label: "Threads", href: threadsShareHref(input.text, input.url) },
    { channel: "facebook", label: "Facebook", href: facebookShareHref(input.url, input.text) },
    { channel: "linkedin", label: "LinkedIn", href: linkedinShareHref(input.url) },
    { channel: "reddit", label: "Reddit", href: redditShareHref(input.url, input.text) },
    { channel: "email", label: "Email", href: emailShareHref(subject, withUrl) },
  ];
}

// Milestone copy never includes answer text, names, or a connection id — only
// the public site URL and a line about the moment.
export function milestoneShareText(kind: "first_reveal" | "reveal" | "streak", detail?: { count?: number; streak?: number }): string {
  switch (kind) {
    case "first_reveal":
      return `We just revealed our first ${detail?.count ? `${detail.count} ` : ""}questions to each other on Relationship Copilot. Answer in private, reveal together.`;
    case "streak":
      return `${detail?.streak ?? ""}-day streak of answering one question a day together on Relationship Copilot.`.replace(/^-day/, "A multi-day");
    default:
      return "We answered today's question for each other on Relationship Copilot. Answer in private, reveal together.";
  }
}
