import { describe, expect, it } from "vitest";
import {
  AUTH_LINK_FAILED_MESSAGE,
  normalizeAuthNextParam,
  parseConfirmOtpType,
} from "@/lib/authConfirm";

describe("AUTH_LINK_FAILED_MESSAGE", () => {
  it("mentions same device/browser and reuse, not only expiry", () => {
    expect(AUTH_LINK_FAILED_MESSAGE.toLowerCase()).toContain("same device");
    expect(AUTH_LINK_FAILED_MESSAGE.toLowerCase()).toContain("browser");
    expect(AUTH_LINK_FAILED_MESSAGE.toLowerCase()).toMatch(/already.*used|used/);
    expect(AUTH_LINK_FAILED_MESSAGE.toLowerCase()).not.toMatch(/^.*expired.*$/);
  });
});

describe("parseConfirmOtpType", () => {
  it("accepts magiclink, signup, and email", () => {
    expect(parseConfirmOtpType("magiclink")).toBe("magiclink");
    expect(parseConfirmOtpType("signup")).toBe("signup");
    expect(parseConfirmOtpType("email")).toBe("email");
  });

  it("rejects unknown, empty, and missing types", () => {
    expect(parseConfirmOtpType("recovery")).toBeNull();
    expect(parseConfirmOtpType("invite")).toBeNull();
    expect(parseConfirmOtpType("")).toBeNull();
    expect(parseConfirmOtpType(null)).toBeNull();
    expect(parseConfirmOtpType(undefined)).toBeNull();
  });
});

describe("normalizeAuthNextParam", () => {
  const origin = "https://app.example.com";

  it("returns empty when missing", () => {
    expect(normalizeAuthNextParam(null, origin)).toBe("");
    expect(normalizeAuthNextParam(undefined, origin)).toBe("");
    expect(normalizeAuthNextParam("", origin)).toBe("");
  });

  it("keeps ordinary internal paths", () => {
    expect(normalizeAuthNextParam("/invite/XYZ", origin)).toBe("/invite/XYZ");
    expect(normalizeAuthNextParam("/connections/abc?x=1", origin)).toBe(
      "/connections/abc?x=1",
    );
  });

  it("preserves invite and inviter next through callback/confirm", () => {
    // /auth/callback and /auth/confirm both call normalizeAuthNextParam so an
    // invite deep link and the inviter start path survive Google + magic-link.
    expect(normalizeAuthNextParam("/invite/ABC12345", origin)).toBe(
      "/invite/ABC12345",
    );
    expect(normalizeAuthNextParam("/connections/new", origin)).toBe(
      "/connections/new",
    );
    expect(
      normalizeAuthNextParam(
        "https://app.example.com/invite/ABC12345",
        origin,
      ),
    ).toBe("/invite/ABC12345");
  });

  it("strips a same-origin absolute URL prefix", () => {
    expect(
      normalizeAuthNextParam("https://app.example.com/invite/XYZ", origin),
    ).toBe("/invite/XYZ");
    expect(
      normalizeAuthNextParam(
        "https://app.example.com/onboarding?step=1",
        origin,
      ),
    ).toBe("/onboarding?step=1");
  });

  it("rejects off-origin absolute URLs and scheme tricks", () => {
    expect(
      normalizeAuthNextParam("https://evil.example/phish", origin),
    ).toBe("");
    expect(normalizeAuthNextParam("//evil.example/phish", origin)).toBe("");
    expect(normalizeAuthNextParam("javascript:alert(1)", origin)).toBe("");
    // Open-redirect guard: empty fallback (not the evil path) for auth routes.
    expect(
      normalizeAuthNextParam("https://evil.example/invite/ABC12345", origin),
    ).toBe("");
  });
});
