import { describe, expect, it } from "vitest";
import {
  classifyInviteLookup,
  inviteCodeFromNext,
  INVITE_FAILURE_COPY,
  loginHeadline,
  loginIntentFromNext,
  loginSubhead,
} from "./inviteStatus";

describe("classifyInviteLookup", () => {
  it("marks malformed codes invalid (never 'used')", () => {
    expect(
      classifyInviteLookup({
        code: "SHORT",
        foundActive: false,
        expired: false,
        retiredAsUsed: false,
      }),
    ).toBe("invalid");
    expect(
      classifyInviteLookup({
        code: "UXTEST00!",
        foundActive: false,
        expired: false,
        retiredAsUsed: true,
      }),
    ).toBe("invalid");
  });

  it("marks unknown well-formed codes invalid, not used", () => {
    expect(
      classifyInviteLookup({
        code: "UXTEST00",
        foundActive: false,
        expired: false,
        retiredAsUsed: false,
      }),
    ).toBe("invalid");
    expect(INVITE_FAILURE_COPY.invalid.title.toLowerCase()).not.toContain(
      "already been used",
    );
  });

  it("marks retired-as-used codes as used", () => {
    expect(
      classifyInviteLookup({
        code: "USEDCODE",
        foundActive: false,
        expired: false,
        retiredAsUsed: true,
      }),
    ).toBe("used");
    expect(INVITE_FAILURE_COPY.used.title).toMatch(/already been used/i);
  });

  it("marks found+expired as expired and found+open as ok", () => {
    expect(
      classifyInviteLookup({
        code: "OPENCODE",
        foundActive: true,
        expired: true,
        retiredAsUsed: false,
      }),
    ).toBe("expired");
    expect(
      classifyInviteLookup({
        code: "OPENCODE",
        foundActive: true,
        expired: false,
        retiredAsUsed: false,
      }),
    ).toBe("ok");
  });
});

describe("inviteCodeFromNext / loginIntentFromNext", () => {
  it("extracts a well-formed invite code from next", () => {
    expect(inviteCodeFromNext("/invite/ABC12345")).toBe("ABC12345");
    expect(inviteCodeFromNext("/invite/abc12345?x=1")).toBe("ABC12345");
    expect(inviteCodeFromNext("/invite/SHORT")).toBeNull();
    expect(inviteCodeFromNext("/connections")).toBeNull();
    expect(inviteCodeFromNext(null)).toBeNull();
  });

  it("classifies invitee, inviter, and generic intents", () => {
    expect(loginIntentFromNext("/invite/ABC12345")).toEqual({
      kind: "invitee",
      inviteCode: "ABC12345",
    });
    expect(loginIntentFromNext("/connections/new")).toEqual({
      kind: "inviter",
    });
    expect(loginIntentFromNext("/connections")).toEqual({ kind: "generic" });
    expect(loginIntentFromNext(null)).toEqual({ kind: "generic" });
  });
});

describe("loginHeadline / loginSubhead", () => {
  it("names the inviter for invitees when known", () => {
    expect(loginHeadline({ kind: "invitee", inviteCode: "ABC12345" }, "Sam")).toBe(
      "Sam invited you",
    );
    expect(
      loginSubhead({ kind: "invitee", inviteCode: "ABC12345" }, "Sam"),
    ).toBe(
      "Sign in and you'll come straight back to Sam's invite and join automatically.",
    );
  });

  it("falls back when the inviter name is unknown", () => {
    expect(
      loginHeadline({ kind: "invitee", inviteCode: "ABC12345" }, null),
    ).toBe("You're invited");
    expect(
      loginSubhead({ kind: "invitee", inviteCode: "ABC12345" }, null),
    ).toBe(
      "Sign in and you'll come straight back to your invite and join automatically.",
    );
  });

  it("uses inviter intent copy for /connections/new", () => {
    expect(loginHeadline({ kind: "inviter" }, null)).toBe(
      "Sign in to invite your person",
    );
    expect(loginSubhead({ kind: "inviter" }, null)).toContain(
      "create a connection",
    );
  });

  it("keeps generic welcome copy without intent", () => {
    expect(loginHeadline({ kind: "generic" }, null)).toBe("Welcome");
    expect(loginSubhead({ kind: "generic" }, null)).toBe(
      "Sign in or create your free account. It's the same steps either way.",
    );
  });
});
