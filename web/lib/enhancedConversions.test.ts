import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adsEnhancedConsentGranted,
  fireEmailSignUpConversion,
  normalizeEmailForHash,
  readAdsConsentFlags,
  setEnhancedConversionUserDataIfAllowed,
  sha256EmailHex,
} from "./enhancedConversions";

describe("normalizeEmailForHash / sha256EmailHex", () => {
  it("trims and lowercases before hashing", () => {
    expect(normalizeEmailForHash("  Sam@Example.COM ")).toBe("sam@example.com");
  });

  it("hashes the normalized email with SHA-256 hex", async () => {
    const a = await sha256EmailHex("  Sam@Example.COM ");
    const b = await sha256EmailHex("sam@example.com");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    // Known SHA-256 of "sam@example.com"
    expect(a).toBe(
      "cd25a6171969f2a3c6e35c7667e3908ef1bd2424241db04411a0eec454ca6c16",
    );
  });
});

describe("readAdsConsentFlags / adsEnhancedConsentGranted", () => {
  it("defaults to denied when the dataLayer is empty", () => {
    expect(readAdsConsentFlags([])).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
    });
    expect(adsEnhancedConsentGranted([])).toBe(false);
  });

  it("stays denied after ConsentDefaults-style default + analytics-only update", () => {
    const layer = [
      [
        "consent",
        "default",
        {
          ad_storage: "denied",
          ad_user_data: "denied",
          analytics_storage: "denied",
        },
      ],
      ["consent", "update", { analytics_storage: "granted" }],
    ];
    expect(adsEnhancedConsentGranted(layer)).toBe(false);
  });

  it("returns true only when both ad flags are granted", () => {
    const layer = [
      [
        "consent",
        "default",
        { ad_storage: "denied", ad_user_data: "denied" },
      ],
      [
        "consent",
        "update",
        { ad_storage: "granted", ad_user_data: "granted" },
      ],
    ];
    expect(adsEnhancedConsentGranted(layer)).toBe(true);
  });
});

describe("setEnhancedConversionUserDataIfAllowed", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no-ops when there is no email", async () => {
    const gtag = vi.fn();
    const ok = await setEnhancedConversionUserDataIfAllowed("", {
      pathname: "/login",
      dataLayer: [
        ["consent", "update", { ad_storage: "granted", ad_user_data: "granted" }],
      ],
      gtag,
    });
    expect(ok).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("no-ops when ads consent is denied", async () => {
    const gtag = vi.fn();
    const ok = await setEnhancedConversionUserDataIfAllowed("sam@example.com", {
      pathname: "/login",
      dataLayer: [
        ["consent", "default", { ad_storage: "denied", ad_user_data: "denied" }],
      ],
      gtag,
    });
    expect(ok).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("no-ops on non-measurable paths", async () => {
    const gtag = vi.fn();
    const ok = await setEnhancedConversionUserDataIfAllowed("sam@example.com", {
      pathname: "/connections/abc",
      dataLayer: [
        ["consent", "update", { ad_storage: "granted", ad_user_data: "granted" }],
      ],
      gtag,
    });
    expect(ok).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("sets hashed user_data only (never raw email) when allowed", async () => {
    const gtag = vi.fn();
    const ok = await setEnhancedConversionUserDataIfAllowed(
      "  Sam@Example.COM ",
      {
        pathname: "/login",
        dataLayer: [
          [
            "consent",
            "update",
            { ad_storage: "granted", ad_user_data: "granted" },
          ],
        ],
        gtag,
      },
    );
    expect(ok).toBe(true);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0][0]).toBe("set");
    expect(gtag.mock.calls[0][1]).toBe("user_data");
    const payload = gtag.mock.calls[0][2] as {
      sha256_email_address: string;
    };
    expect(payload.sha256_email_address).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/Sam@Example|sam@example/i);
  });
});

describe("fireEmailSignUpConversion", () => {
  it("fires sign_up after optional user_data set; skips with no email", async () => {
    const gtag = vi.fn();
    await fireEmailSignUpConversion(null, {
      pathname: "/login",
      dataLayer: [],
      gtag,
    });
    expect(gtag).not.toHaveBeenCalled();

    await fireEmailSignUpConversion("sam@example.com", {
      pathname: "/login",
      dataLayer: [
        ["consent", "default", { ad_storage: "denied", ad_user_data: "denied" }],
      ],
      gtag,
    });
    // Consent denied → no user_data set, but sign_up still fires on measurable path.
    expect(gtag).toHaveBeenCalledWith("event", "sign_up", { method: "email" });
    expect(gtag).not.toHaveBeenCalledWith(
      "set",
      "user_data",
      expect.anything(),
    );
  });
});
