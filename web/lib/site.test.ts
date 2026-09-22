import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, canonicalUrl } from "./site";

describe("canonicalUrl", () => {
  it("uses the apex production marketing host (not www)", () => {
    expect(CANONICAL_ORIGIN).toBe("https://relationshipcopilot.com");
    expect(CANONICAL_ORIGIN).not.toContain("://www.");
  });

  it("canonicalizes home without a trailing slash", () => {
    expect(canonicalUrl()).toBe("https://relationshipcopilot.com");
    expect(canonicalUrl("/")).toBe("https://relationshipcopilot.com");
    expect(canonicalUrl("")).toBe("https://relationshipcopilot.com");
  });

  it("canonicalizes marketing paths without a trailing slash", () => {
    expect(canonicalUrl("/about")).toBe(
      "https://relationshipcopilot.com/about",
    );
    expect(canonicalUrl("pricing")).toBe(
      "https://relationshipcopilot.com/pricing",
    );
    expect(canonicalUrl("/safety/")).toBe(
      "https://relationshipcopilot.com/safety",
    );
  });
});
