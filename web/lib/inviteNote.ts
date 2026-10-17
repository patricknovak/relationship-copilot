// The optional personal note an inviter adds to their invite. Pure and
// unit-tested. The note is shown to the invitee on our own domain, so it is
// kept short, plain text, and link-free (no phishing from a trusted page).

export const INVITE_NOTE_MAX = 280;

export type InviteNoteError = "too_long" | "link";
export type InviteNoteResult = { note: string | null } | { error: InviteNoteError };

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ly|me|app|link|xyz)\b)/i;

export function normalizeInviteNote(raw: unknown): InviteNoteResult {
  if (typeof raw !== "string") return { note: null };
  const note = raw.replace(/\s+/g, " ").trim();
  if (!note) return { note: null }; // empty clears the note
  if (note.length > INVITE_NOTE_MAX) {
    return { error: "too_long" };
  }
  if (LINK_RE.test(note)) {
    return { error: "link" };
  }
  return { note };
}
