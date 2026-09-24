import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_MUTUAL_REVEAL_COMPLETED,
  isConnectionFirstReveal,
  sendGa4Event,
  trackFirstMutualRevealCompleted,
} from "./ga4";

describe("isConnectionFirstReveal", () => {
  it("is true only for the first revealed instance", () => {
    expect(isConnectionFirstReveal(0)).toBe(false);
    expect(isConnectionFirstReveal(1)).toBe(true);
    expect(isConnectionFirstReveal(2)).toBe(false);
  });
});

describe("FIRST_MUTUAL_REVEAL_COMPLETED", () => {
  it("uses the exact GA4 event name from the brief", () => {
    expect(FIRST_MUTUAL_REVEAL_COMPLETED).toBe("first_mutual_reveal_completed");
  });
});

describe("sendGa4Event", () => {
  const originalFetch = globalThis.fetch;
  const originalMeasurement = process.env.GA4_MEASUREMENT_ID;
  const originalSecret = process.env.GA4_API_SECRET;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMeasurement === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = originalMeasurement;
    if (originalSecret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = originalSecret;
    vi.restoreAllMocks();
  });

  it("no-ops when Measurement Protocol credentials are unset", async () => {
    delete process.env.GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(sendGa4Event("first_mutual_reveal_completed")).resolves.toBe(
      false,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs an anonymous MP payload with the exact event name", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(trackFirstMutualRevealCompleted()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("measurement_id=G-3HE7V5FTSR");
    expect(url).toContain("api_secret=test-secret");
    expect(url).toContain("https://www.google-analytics.com/mp/collect");

    const body = JSON.parse(String(init.body)) as {
      client_id: string;
      non_personalized_ads: boolean;
      events: { name: string; params: Record<string, unknown> }[];
    };
    expect(body.client_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.non_personalized_ads).toBe(true);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].name).toBe("first_mutual_reveal_completed");
    // Privacy: no user/connection identifiers in the payload.
    expect(JSON.stringify(body)).not.toMatch(/user_id|connection|invite/i);
    expect(body.events[0].params.engagement_time_msec).toBe(1);
  });

  it("swallows network failures so reveal UX never blocks", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch;

    await expect(trackFirstMutualRevealCompleted()).resolves.toBe(false);
  });
});
