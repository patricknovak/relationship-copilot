import { describe, expect, it } from "vitest";
import { resolveTurnstileSiteKey } from "./turnstile";

// Must match the Cloudflare dashboard widget `relationship-copilot`
// (Managed, relationshipcopilot.com). Do not "fix" by adding characters —
// a single extra A ships as a dead key and blocks magic-link sign-in.
const PRODUCTION_SITE_KEY = "0x4AAAAAAEMK007CLbb2ryAl";

describe("resolveTurnstileSiteKey", () => {
  it("falls back to the production site key when unset or blank", () => {
    expect(resolveTurnstileSiteKey(undefined)).toBe(PRODUCTION_SITE_KEY);
    expect(resolveTurnstileSiteKey(null)).toBe(PRODUCTION_SITE_KEY);
    expect(resolveTurnstileSiteKey("  ")).toBe(PRODUCTION_SITE_KEY);
  });

  it("does not ship the known typo (extra A after 0x4)", () => {
    const resolved = resolveTurnstileSiteKey(undefined);
    expect(resolved).not.toBe("0x4AAAAAAAEMK007CLbb2ryAl");
    expect(resolved).toBe("0x4AAAAAAEMK007CLbb2ryAl");
    expect(resolved).toHaveLength(24);
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
