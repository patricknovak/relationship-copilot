import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "./authErrors";

describe("friendlyAuthError", () => {
  it("never shows raw provider or config text", () => {
    const raw = "captcha protection: request disallowed (invalid-input-secret)";
    expect(friendlyAuthError(raw)).not.toContain("invalid-input-secret");
    expect(friendlyAuthError(raw)).toMatch(/security check/i);
  });

  it("maps the common cases", () => {
    expect(friendlyAuthError("Email rate limit exceeded")).toMatch(/wait a minute/i);
    expect(friendlyAuthError("For security purposes, you can only request this after 42 seconds."))
      .toMatch(/wait a minute/i);
    expect(friendlyAuthError("Unable to validate email address: invalid format")).toMatch(
      /doesn't look right/i,
    );
    expect(friendlyAuthError("Failed to fetch")).toMatch(/connection/i);
    expect(friendlyAuthError("something unexpected")).toMatch(/try again/i);
    expect(friendlyAuthError("")).toMatch(/try again/i);
  });
});
