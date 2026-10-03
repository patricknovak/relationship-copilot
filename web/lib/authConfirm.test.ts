import { describe, expect, it } from "vitest";
import {
  normalizeAuthNextParam,
  parseConfirmOtpType,
} from "@/lib/authConfirm";

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
  });
});
