import { describe, expect, it } from "vitest";
import { continueLine, signInVia } from "./signInCopy";

describe("sign-in copy follows NEXT_PUBLIC_AUTH_PROVIDERS", () => {
  it("names the configured providers", () => {
    expect(signInVia("google")).toBe("Google");
    expect(signInVia("google,apple")).toBe("Google or Apple");
    expect(signInVia("google,apple,facebook")).toBe("Google, Apple or Facebook");
    expect(continueLine("google")).toBe("Continue with Google — no password to invent.");
  });

  it("falls back to the email link when no provider is on", () => {
    expect(signInVia("none")).toBe("a secure email link");
    expect(continueLine("none")).toMatch(/email link/);
  });
});
