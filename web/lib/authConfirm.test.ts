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

  it("unwraps a RedirectTo that points at our own auth callback", () => {
    // The login form sends emailRedirectTo = /auth/callback?next=<dest>, so a
    // template forwarding {{ .RedirectTo }} hands /auth/confirm this value.
    expect(
      normalizeAuthNextParam(
        "https://app.example.com/auth/callback?next=%2Finvite%2FABC12345",
        origin,
      ),
    ).toBe("/invite/ABC12345");
    expect(
      normalizeAuthNextParam(
        "/auth/confirm?next=%2Fconnections%2Fnew%3Ftype%3Dsibling",
        origin,
      ),
    ).toBe("/connections/new?type=sibling");
  });

  it("treats a bare auth route as no destination", () => {
    // No inner next: fall through to the new-user routing instead of
    // bouncing a signed-in user through /auth/callback as a failed link.
    expect(
      normalizeAuthNextParam("https://app.example.com/auth/callback?next=", origin),
    ).toBe("");
    expect(normalizeAuthNextParam("/auth/callback", origin)).toBe("");
    expect(normalizeAuthNextParam("/auth/confirm?token_hash=x", origin)).toBe("");
  });

  it("keeps the open-redirect guard on the unwrapped destination", () => {
    expect(
      normalizeAuthNextParam(
        "/auth/callback?next=https%3A%2F%2Fevil.example%2Fphish",
        origin,
      ),
    ).toBe("");
    expect(
      normalizeAuthNextParam("/auth/callback?next=%2F%2Fevil.example", origin),
    ).toBe("");
    // Endless self-wrapping resolves to nothing rather than looping.
    const wrap = (inner: string) => `/auth/callback?next=${encodeURIComponent(inner)}`;
    expect(normalizeAuthNextParam(wrap(wrap(wrap(wrap("/x")))), origin)).toBe("");
  });

  it("does not unwrap ordinary pages that merely carry a next param", () => {
    expect(normalizeAuthNextParam("/onboarding?next=%2Fconnections", origin)).toBe(
      "/onboarding?next=%2Fconnections",
    );
    expect(normalizeAuthNextParam("/auth/callbacks?next=%2Fx", origin)).toBe(
      "/auth/callbacks?next=%2Fx",
    );
  });
});
