import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  isMeasurablePath,
  parseAnalyticsConsent,
  pushQuestionsCtaClick,
  shouldLoadGtm,
  shouldPromptForConsent,
} from "./analytics";

describe("parseAnalyticsConsent", () => {
  it("accepts only granted or denied", () => {
    expect(parseAnalyticsConsent("granted")).toBe("granted");
    expect(parseAnalyticsConsent("denied")).toBe("denied");
    expect(parseAnalyticsConsent(null)).toBeNull();
    expect(parseAnalyticsConsent("")).toBeNull();
    expect(parseAnalyticsConsent("maybe")).toBeNull();
  });
});

// The point of these tests is the privacy boundary: no authenticated route
// may ever be measurable, because its path can carry a connection or invite
// ID. If someone adds a route, this is the place that should fail loudly.
describe("isMeasurablePath", () => {
  it("allows the public marketing surface", () => {
    for (const p of [
      "/",
      "/about",
      "/pricing",
      "/safety",
      "/library",
      "/library/some-article",
      "/questions",
      "/questions/partners",
      "/login",
      "/privacy",
      "/terms",
    ]) {
      expect(isMeasurablePath(p), p).toBe(true);
    }
  });

  it("never measures authenticated or invite routes", () => {
    for (const p of [
      "/connections",
      "/connections/abc-123",
      "/connections/abc-123/blueprint",
      "/connections/abc-123/prompts/xyz",
      "/account",
      "/onboarding",
      "/auth/callback",
      "/invite/SECRETCODE",
    ]) {
      expect(isMeasurablePath(p), p).toBe(false);
    }
  });
});

describe("shouldPromptForConsent", () => {
  it("does not show a cookie banner on the crisis page", () => {
    expect(shouldPromptForConsent("/safety")).toBe(false);
  });

  it("shows on ordinary marketing pages", () => {
    expect(shouldPromptForConsent("/")).toBe(true);
    expect(shouldPromptForConsent("/pricing")).toBe(true);
  });

  it("never shows inside the app", () => {
    expect(shouldPromptForConsent("/connections/abc")).toBe(false);
  });
});

describe("shouldLoadGtm", () => {
  it("loads only on measurable paths with granted consent", () => {
    expect(shouldLoadGtm("/", "granted")).toBe(true);
    expect(shouldLoadGtm("/pricing", "granted")).toBe(true);
    expect(shouldLoadGtm("/", "denied")).toBe(false);
    expect(shouldLoadGtm("/", null)).toBe(false);
    expect(shouldLoadGtm("/connections", "granted")).toBe(false);
    expect(shouldLoadGtm("/invite/ABC", "granted")).toBe(false);
  });
});

describe("pushQuestionsCtaClick", () => {
  function stubWindow(pathname: string, consent: "granted" | "denied" | null) {
    const store = new Map<string, string>();
    if (consent) store.set(CONSENT_STORAGE_KEY, consent);
    const dataLayer: Record<string, unknown>[] = [];
    const fakeWindow = {
      location: { pathname },
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
      dataLayer,
    };
    vi.stubGlobal("window", fakeWindow);
    return dataLayer;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pushes questions_cta_click with page when consent is granted", () => {
    const dataLayer = stubWindow("/questions/partners", "granted");
    pushQuestionsCtaClick("partners");
    expect(dataLayer).toEqual([
      { event: "questions_cta_click", page: "partners" },
    ]);
  });

  it("no-ops without consent", () => {
    const dataLayer = stubWindow("/questions", "denied");
    pushQuestionsCtaClick("hub");
    expect(dataLayer).toEqual([]);
  });

  it("no-ops on private paths", () => {
    const dataLayer = stubWindow("/connections/abc", "granted");
    pushQuestionsCtaClick("partners");
    expect(dataLayer).toEqual([]);
  });
});
