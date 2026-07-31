import { describe, expect, it } from "vitest";
import { parseAuthProviders } from "./authProviders";

describe("parseAuthProviders", () => {
  it("shows every provider when unset or blank", () => {
    expect(parseAuthProviders(undefined)).toEqual([
      "google",
      "apple",
      "facebook",
    ]);
    expect(parseAuthProviders(null)).toEqual(["google", "apple", "facebook"]);
    expect(parseAuthProviders("  ")).toEqual(["google", "apple", "facebook"]);
  });

  it("returns only the listed providers, preserving canonical order", () => {
    expect(parseAuthProviders("google")).toEqual(["google"]);
    expect(parseAuthProviders("facebook,google")).toEqual([
      "google",
      "facebook",
    ]);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(parseAuthProviders(" Google , APPLE ")).toEqual(["google", "apple"]);
  });

  it("ignores unknown names, so a sentinel like 'none' hides all buttons", () => {
    expect(parseAuthProviders("none")).toEqual([]);
    expect(parseAuthProviders("google,twitter")).toEqual(["google"]);
  });
});
