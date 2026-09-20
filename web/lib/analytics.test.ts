import { describe, expect, it } from "vitest";
import { isMeasurablePath, shouldPromptForConsent } from "./analytics";

// The point of these tests is the privacy boundary: no authenticated route
// may ever be measurable, because its path can carry a connection or invite
// ID. If someone adds a route, this is the place that should fail loudly.
describe("isMeasurablePath", () => {
  it("allows the public marketing surface", () => {
    for (const p of [
      "/",
      "/about",
      "/pricing",
      "/safety",
      "/library",
      "/library/some-article",
      "/login",
      "/privacy",
      "/terms",
    ]) {
      expect(isMeasurablePath(p), p).toBe(true);
    }
  });

  it("never measures authenticated or invite routes", () => {
    for (const p of [
      "/connections",
      "/connections/abc-123",
      "/connections/abc-123/blueprint",
      "/connections/abc-123/prompts/xyz",
      "/account",
      "/onboarding",
      "/auth/callback",
      "/invite/SECRETCODE",
    ]) {
      expect(isMeasurablePath(p), p).toBe(false);
    }
  });
});

describe("shouldPromptForConsent", () => {
  it("does not show a cookie banner on the crisis page", () => {
    expect(shouldPromptForConsent("/safety")).toBe(false);
  });

  it("shows on ordinary marketing pages", () => {
    expect(shouldPromptForConsent("/")).toBe(true);
    expect(shouldPromptForConsent("/pricing")).toBe(true);
  });

  it("never shows inside the app", () => {
    expect(shouldPromptForConsent("/connections/abc")).toBe(false);
  });
});
