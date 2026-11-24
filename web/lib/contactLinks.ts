/**
 * Turns a crisis-line contact string ("Call 1-800-799-7233 · Text START to
 * 88788") into parts a phone can act on, without changing a word of it:
 * "Call …" segments become tel: links and "Text KEYWORD to …" segments become
 * sms: links with the keyword prefilled. Anything unrecognised stays text.
 */
export type ContactPart = { text: string; href?: string };

const SEPARATOR = " · ";
const CALL = /^(?:Call or text|Call)\s+([\d-]+)$/i;
const TEXT = /^Text\s+(\S+)\s+to\s+([\d-]+)$/i;

function telHref(number: string): string {
  const digits = number.replace(/\D/g, "");
  // North American long numbers get the country code; short codes (988) do not.
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+1${digits}`;
  return `tel:${digits}`;
}

function smsHref(number: string, keyword: string): string {
  // "?&body=" is the form both iOS and Android accept.
  return `sms:${number.replace(/\D/g, "")}?&body=${encodeURIComponent(keyword)}`;
}

export function contactParts(contact: string): ContactPart[] {
  const parts: ContactPart[] = [];
  contact.split(SEPARATOR).forEach((segment, i) => {
    if (i > 0) parts.push({ text: SEPARATOR });
    const call = CALL.exec(segment);
    const text = TEXT.exec(segment);
    if (call) parts.push({ text: segment, href: telHref(call[1]) });
    else if (text) parts.push({ text: segment, href: smsHref(text[2], text[1]) });
    else parts.push({ text: segment });
  });
  return parts;
}
