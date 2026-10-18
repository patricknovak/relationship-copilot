import { afterEach, describe, expect, it, vi } from "vitest";

describe("getStripe", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("pins apiVersion to the SDK's expected LatestApiVersion", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_pin_api_version");
    const { getStripe, STRIPE_API_VERSION } = await import("./stripe");
    const stripe = getStripe();
    expect(STRIPE_API_VERSION).toBe("2026-09-30.endive");
    expect(stripe.getApiField("version")).toBe(STRIPE_API_VERSION);
  });

  it("throws when STRIPE_SECRET_KEY is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { getStripe } = await import("./stripe");
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });
});
