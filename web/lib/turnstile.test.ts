import { describe, expect, it } from "vitest";
import { resolveTurnstileSiteKey } from "./turnstile";

describe("resolveTurnstileSiteKey", () => {
  it("falls back to the production site key when unset or blank", () => {
    expect(resolveTurnstileSiteKey(undefined)).toMatch(/^0x/);
    expect(resolveTurnstileSiteKey(null)).toMatch(/^0x/);
    expect(resolveTurnstileSiteKey("  ")).toMatch(/^0x/);
  });

  it("returns null for the disable sentinels, any case", () => {
    expect(resolveTurnstileSiteKey("off")).toBeNull();
    expect(resolveTurnstileSiteKey("None")).toBeNull();
    expect(resolveTurnstileSiteKey("DISABLED")).toBeNull();
  });

  it("passes through an explicit site key, trimmed", () => {
    expect(resolveTurnstileSiteKey(" 1x00000000000000000000AA ")).toBe(
      "1x00000000000000000000AA",
    );
  });
});
