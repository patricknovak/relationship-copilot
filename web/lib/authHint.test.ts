import { describe, expect, it } from "vitest";
import { AUTH_HINT_SCRIPT, hasSessionCookie } from "./authHint";

describe("hasSessionCookie", () => {
  it("detects the Supabase SSR session cookie, plain or chunked", () => {
    expect(hasSessionCookie("sb-digbnrhwsifmycrxyquo-auth-token=base64-abc")).toBe(true);
    expect(hasSessionCookie("theme=dark; sb-abc123-auth-token.0=base64-x; other=1")).toBe(true);
  });

  it("ignores other cookies, empty values and lookalikes", () => {
    expect(hasSessionCookie("")).toBe(false);
    expect(hasSessionCookie(null)).toBe(false);
    expect(hasSessionCookie("theme=dark; consent=granted")).toBe(false);
    expect(hasSessionCookie("sb-abc-auth-token=")).toBe(false);
    expect(hasSessionCookie("xsb-abc-auth-token=1")).toBe(false);
    expect(hasSessionCookie("sb-abc-auth-token-code-verifier=pkce")).toBe(false);
  });
});

describe("AUTH_HINT_SCRIPT", () => {
  it("is a self-contained IIFE that only sets data-auth", () => {
    expect(AUTH_HINT_SCRIPT.startsWith("(function(){try{")).toBe(true);
    expect(AUTH_HINT_SCRIPT).toContain("setAttribute('data-auth','in')");
    expect(AUTH_HINT_SCRIPT).not.toContain("</script");
  });

  it("evaluates correctly against a fake document", () => {
    const attrs: Record<string, string> = {};
    const doc = {
      cookie: "sb-abc-auth-token=xyz",
      documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
    };
    new Function("document", AUTH_HINT_SCRIPT)(doc);
    expect(attrs["data-auth"]).toBe("in");

    const none: Record<string, string> = {};
    new Function("document", AUTH_HINT_SCRIPT)({
      cookie: "theme=dark",
      documentElement: { setAttribute: (k: string, v: string) => (none[k] = v) },
    });
    expect(none["data-auth"]).toBeUndefined();
  });
});
