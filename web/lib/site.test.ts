import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, canonicalUrl } from "./site";

describe("canonicalUrl", () => {
  it("uses the production marketing host", () => {
    expect(CANONICAL_ORIGIN).toBe("https://relationshipcopilot.com");
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
