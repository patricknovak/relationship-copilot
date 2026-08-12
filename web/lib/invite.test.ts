import { describe, expect, it } from "vitest";
import { buildInviteMessage, smsHref, whatsappHref } from "./invite";

const URL_ = "https://relationshipcopilot.com/invite/ABC123";

describe("buildInviteMessage", () => {
  it("leads with the inviter's name when known", () => {
    const msg = buildInviteMessage("Sam", URL_);
    expect(msg).toMatch(/^Sam invited you/);
    expect(msg).toContain(URL_);
  });

  it("falls back to a first-person opener without a name", () => {
    for (const name of [null, undefined, "  "]) {
      const msg = buildInviteMessage(name, URL_);
      expect(msg).toMatch(/^Join me/);
      expect(msg).toContain(URL_);
    }
  });
});

describe("share hrefs", () => {
  it("builds the cross-platform sms href with an encoded body", () => {
    const href = smsHref("hi there: x?&y");
    expect(href.startsWith("sms:?&body=")).toBe(true);
    expect(href).toContain(encodeURIComponent("hi there: x?&y"));
  });

  it("builds a wa.me link with encoded text", () => {
    expect(whatsappHref("a b")).toBe("https://wa.me/?text=a%20b");
  });
});
