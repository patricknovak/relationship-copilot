import { describe, expect, it } from "vitest";
import { edgeCacheKey, isCacheableResponse, OG_CACHE_CONTROL } from "./edgeCache";

const O = "https://relationshipcopilot.com";

describe("edgeCacheKey", () => {
  it("keys the site OG image by its content hash", () => {
    expect(edgeCacheKey("GET", `${O}/opengraph-image?8d3926ed8883ffa4`)).toBe(
      `${O}/opengraph-image?8d3926ed8883ffa4`,
    );
    expect(edgeCacheKey("GET", `${O}/opengraph-image`)).toBe(`${O}/opengraph-image`);
  });

  it("collapses every invite code onto one key (the image never varies by code)", () => {
    const a = edgeCacheKey("GET", `${O}/invite/ABCDEFGH/opengraph-image?15370f4b`);
    const b = edgeCacheKey("GET", `${O}/invite/ZZZZ9999/opengraph-image?15370f4b`);
    expect(a).toBe(`${O}/invite/_/opengraph-image?15370f4b`);
    expect(b).toBe(a);
  });

  it("never caches pages, other methods, or lookalike paths", () => {
    expect(edgeCacheKey("GET", `${O}/`)).toBeNull();
    expect(edgeCacheKey("GET", `${O}/invite/ABCDEFGH`)).toBeNull();
    expect(edgeCacheKey("POST", `${O}/opengraph-image`)).toBeNull();
    expect(edgeCacheKey("GET", `${O}/invite/a/b/opengraph-image`)).toBeNull();
    expect(edgeCacheKey("GET", `${O}/opengraph-image/x`)).toBeNull();
    expect(edgeCacheKey("GET", "not a url")).toBeNull();
  });
});

describe("isCacheableResponse", () => {
  it("stores only successful images", () => {
    expect(isCacheableResponse(200, "image/png")).toBe(true);
    expect(isCacheableResponse(500, "image/png")).toBe(false);
    expect(isCacheableResponse(200, "text/html")).toBe(false);
    expect(isCacheableResponse(200, null)).toBe(false);
  });

  it("uses a long shared TTL", () => {
    expect(OG_CACHE_CONTROL).toContain("s-maxage=604800");
  });
});
