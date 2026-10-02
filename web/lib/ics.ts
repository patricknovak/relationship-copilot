// Client-side .ics builder for a personal reminder (no server route, no
// analytics, no answer content). RFC 5545 fold/escape rules kept minimal.

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date as a floating local DATETIME (YYYYMMDDTHHMMSS). */
export function formatIcsLocalDateTime(d: Date): string {
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

/** Format a Date as UTC TIMESTAMP (YYYYMMDDTHHMMSSZ) for DTSTAMP. */
export function formatIcsUtcDateTime(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

/** Escape TEXT values per RFC 5545 §3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

const utf8 = new TextEncoder();

/**
 * Fold a single content line to ≤75 UTF-8 octets per RFC 5545 §3.1.
 * Inserts CRLF + a single SPACE; never splits a multi-byte character.
 * Continuation lines count the leading SPACE toward the 75-octet limit.
 */
export function foldIcsLine(line: string): string {
  const totalBytes = utf8.encode(line).length;
  if (totalBytes <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let first = true;

  while (offset < line.length) {
    const budget = first ? 75 : 74; // leading SPACE on continuations
    let end = offset;
    let used = 0;
    while (end < line.length) {
      const cp = line.codePointAt(end)!;
      const ch = String.fromCodePoint(cp);
      const n = utf8.encode(ch).length;
      if (used + n > budget) break;
      used += n;
      end += ch.length;
    }
    if (end === offset) {
      // Single code point larger than budget (shouldn't happen for ≤4-byte UTF-8
      // within a 74-byte budget) — advance one code point to avoid a hang.
      const cp = line.codePointAt(offset)!;
      end = offset + String.fromCodePoint(cp).length;
    }
    const chunk = line.slice(offset, end);
    parts.push(first ? chunk : ` ${chunk}`);
    first = false;
    offset = end;
  }

  return parts.join("\r\n");
}

export type ReminderIcsInput = {
  title: string;
  description: string;
  /** Event start in the user's local timezone. */
  start: Date;
  /** Duration in minutes (default 15). */
  durationMinutes?: number;
  /** Stable unique id; generated if omitted. */
  uid?: string;
  /** DTSTAMP; defaults to now. */
  stamp?: Date;
};

/**
 * Build an RFC 5545 VCALENDAR string with CRLF line endings.
 * Uses floating local times (no TZID) so the calendar app keeps the wall clock
 * the user chose. No answer content belongs in description.
 */
export function buildReminderIcs(input: ReminderIcsInput): string {
  const duration = input.durationMinutes ?? 15;
  const end = new Date(input.start.getTime() + duration * 60_000);
  const stamp = input.stamp ?? new Date();
  const uid =
    input.uid ??
    `${stamp.getTime()}-${Math.random().toString(36).slice(2, 10)}@relationshipcopilot.com`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Relationship Copilot//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtcDateTime(stamp)}`,
    `DTSTART:${formatIcsLocalDateTime(input.start)}`,
    `DTEND:${formatIcsLocalDateTime(end)}`,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(input.title)}`,
    "TRIGGER:-PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Default reminder start: tomorrow at 7:00 PM local. */
export function defaultReminderStart(now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}
