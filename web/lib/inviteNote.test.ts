import { describe, expect, it } from "vitest";
import { INVITE_NOTE_MAX, normalizeInviteNote } from "./inviteNote";

describe("normalizeInviteNote", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeInviteNote("  I miss\n\nour   talks.  ")).toEqual({ note: "I miss our talks." });
  });

  it("treats empty or missing input as clearing the note", () => {
    expect(normalizeInviteNote("   ")).toEqual({ note: null });
    expect(normalizeInviteNote(undefined)).toEqual({ note: null });
    expect(normalizeInviteNote(42)).toEqual({ note: null });
  });

  it("enforces the length limit", () => {
    expect(normalizeInviteNote("x".repeat(INVITE_NOTE_MAX))).toEqual({ note: "x".repeat(INVITE_NOTE_MAX) });
    expect(normalizeInviteNote("x".repeat(INVITE_NOTE_MAX + 1))).toEqual({ error: "too_long" });
  });

  it("refuses links", () => {
    for (const s of ["see https://x.test", "go to www.example", "visit evil.com now", "bit.ly/abc"]) {
      expect(normalizeInviteNote(s)).toEqual({ error: "link" });
    }
    // Ordinary sentences with periods are fine.
    expect(normalizeInviteNote("Dad. I mean it. Let's talk more.")).toEqual({
      note: "Dad. I mean it. Let's talk more.",
    });
  });
});
