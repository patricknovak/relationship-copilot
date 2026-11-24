import { describe, expect, it } from "vitest";
import {
  CANONICAL_ORIGIN,
  SHARE_IMAGE,
  SITE_NAME,
  canonicalUrl,
  pageOpenGraph,
} from "./site";

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

  it("keeps the share image, site name and type when a page sets its own fields", () => {
    const og = pageOpenGraph({
      title: "Pricing — Relationship Copilot",
      url: canonicalUrl("/pricing"),
    });
    expect(og.title).toBe("Pricing — Relationship Copilot");
    expect(og.url).toBe("https://relationshipcopilot.com/pricing");
    expect(og.type).toBe("website");
    expect(og.siteName).toBe(SITE_NAME);
    expect(og.images).toEqual([SHARE_IMAGE]);
    expect(SHARE_IMAGE.url).toBe("/opengraph-image");
  });
});
