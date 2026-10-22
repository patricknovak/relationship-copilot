import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn<(task: () => unknown | Promise<unknown>) => void>();

vi.mock("next/server", () => ({
  after: (task: () => unknown | Promise<unknown>) => afterMock(task),
}));

import {
  FIRST_MUTUAL_REVEAL_COMPLETED,
  FIRST_QUESTION_ANSWERED,
  INVITE_SENT,
  PARTNER_JOINED,
  SIGN_UP_COMPLETED,
  ga4ClientIdFromUserId,
  isConnectionFirstReveal,
  resolveGa4ClientId,
  scheduleFirstMutualRevealCompleted,
  scheduleFirstQuestionAnswered,
  scheduleGa4Event,
  scheduleInviteSent,
  schedulePartnerJoined,
  scheduleSignUpCompleted,
  sendGa4Event,
  shouldTrackFirstMutualReveal,
  shouldTrackFunnelStep,
  trackFirstMutualRevealCompleted,
} from "./ga4";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const IDENTITY_A = { userId: USER_A };
const IDENTITY_B = { userId: USER_B };

describe("isConnectionFirstReveal", () => {
  it("is true only for the first revealed instance", () => {
    expect(isConnectionFirstReveal(0)).toBe(false);
    expect(isConnectionFirstReveal(1)).toBe(true);
    expect(isConnectionFirstReveal(2)).toBe(false);
  });
});

describe("shouldTrackFirstMutualReveal", () => {
  it("is true only when the DB claim was granted", () => {
    expect(shouldTrackFirstMutualReveal(true)).toBe(true);
    expect(shouldTrackFirstMutualReveal(false)).toBe(false);
  });
});

describe("shouldTrackFunnelStep", () => {
  it("is true only when the DB claim was granted", () => {
    expect(shouldTrackFunnelStep(true)).toBe(true);
    expect(shouldTrackFunnelStep(false)).toBe(false);
  });
});

describe("FIRST_MUTUAL_REVEAL_COMPLETED", () => {
  it("uses the exact GA4 event name from the brief", () => {
    expect(FIRST_MUTUAL_REVEAL_COMPLETED).toBe("first_mutual_reveal_completed");
  });
});

describe("funnel event names", () => {
  it("uses the exact activation funnel event names", () => {
    expect(SIGN_UP_COMPLETED).toBe("sign_up_completed");
    expect(INVITE_SENT).toBe("invite_sent");
    expect(PARTNER_JOINED).toBe("partner_joined");
    expect(FIRST_QUESTION_ANSWERED).toBe("first_question_answered");
  });

  it("schedulers wrap scheduleGa4Event without throwing", () => {
    expect(() => scheduleSignUpCompleted(IDENTITY_A)).not.toThrow();
    expect(() => scheduleInviteSent(IDENTITY_A)).not.toThrow();
    expect(() => schedulePartnerJoined(IDENTITY_A)).not.toThrow();
    expect(() => scheduleFirstQuestionAnswered(IDENTITY_A)).not.toThrow();
  });
});

describe("ga4ClientIdFromUserId / resolveGa4ClientId", () => {
  it("returns the same client_id for the same user", () => {
    expect(ga4ClientIdFromUserId(USER_A)).toBe(ga4ClientIdFromUserId(USER_A));
    expect(resolveGa4ClientId(IDENTITY_A)).toBe(ga4ClientIdFromUserId(USER_A));
  });

  it("returns different client_ids for different users", () => {
    expect(ga4ClientIdFromUserId(USER_A)).not.toBe(ga4ClientIdFromUserId(USER_B));
  });

  it("shapes the hash as a UUID-like client_id", () => {
    expect(ga4ClientIdFromUserId(USER_A)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("never embeds the raw user id in the client_id", () => {
    const id = ga4ClientIdFromUserId(USER_A);
    expect(id).not.toContain(USER_A);
    expect(id.toLowerCase()).not.toContain(USER_A.replace(/-/g, "").toLowerCase());
  });

  it("prefers a consented browser client_id when passed through", () => {
    const browser = "1234567890.0987654321";
    expect(
      resolveGa4ClientId({
        userId: USER_A,
        browserClientId: browser,
        analyticsConsentGranted: true,
      }),
    ).toBe(browser);
  });

  it("ignores browser client_id without analytics consent", () => {
    const browser = "1234567890.0987654321";
    expect(
      resolveGa4ClientId({
        userId: USER_A,
        browserClientId: browser,
        analyticsConsentGranted: false,
      }),
    ).toBe(ga4ClientIdFromUserId(USER_A));
  });
});

describe("sendGa4Event", () => {
  const originalFetch = globalThis.fetch;
  const originalMeasurement = process.env.GA4_MEASUREMENT_ID;
  const originalSecret = process.env.GA4_API_SECRET;
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMeasurement === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = originalMeasurement;
    if (originalSecret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = originalSecret;
    errorSpy.mockClear();
    vi.clearAllMocks();
  });

  it("no-ops when Measurement Protocol credentials are unset", async () => {
    delete process.env.GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(
      sendGa4Event("first_mutual_reveal_completed", {}, IDENTITY_A),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a stable pseudonymous MP payload with the exact event name", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(trackFirstMutualRevealCompleted(IDENTITY_A)).resolves.toBe(
      true,
    );

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
    expect(body.client_id).toBe(ga4ClientIdFromUserId(USER_A));
    expect(body.non_personalized_ads).toBe(true);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].name).toBe("first_mutual_reveal_completed");
    // Privacy: no user/connection identifiers or PII in the payload.
    const blob = JSON.stringify(body);
    expect(blob).not.toMatch(/user_id|connection|invite/i);
    expect(blob).not.toContain(USER_A);
    expect(blob).not.toMatch(/@|email|display_name|full_name/i);
    expect(body.events[0].params.engagement_time_msec).toBe(1);
  });

  it("reuses the same client_id across funnel events for one user", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    await sendGa4Event(SIGN_UP_COMPLETED, {}, IDENTITY_A);
    await sendGa4Event(INVITE_SENT, {}, IDENTITY_A);
    await sendGa4Event(PARTNER_JOINED, {}, IDENTITY_A);
    await sendGa4Event(FIRST_QUESTION_ANSWERED, {}, IDENTITY_A);
    await sendGa4Event("answered_before_join", {}, IDENTITY_A);
    await sendGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, IDENTITY_A);

    const ids = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(String((call as [string, RequestInit])[1].body)) as {
        client_id: string;
      };
      return body.client_id;
    });
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(ga4ClientIdFromUserId(USER_A));

    // Different user → different id
    await sendGa4Event(SIGN_UP_COMPLETED, {}, IDENTITY_B);
    const bodyB = JSON.parse(
      String((fetchMock.mock.calls.at(-1) as [string, RequestInit])[1].body),
    ) as { client_id: string };
    expect(bodyB.client_id).toBe(ga4ClientIdFromUserId(USER_B));
    expect(bodyB.client_id).not.toBe(ids[0]);
  });

  it("swallows network failures so reveal UX never blocks", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch;

    await expect(trackFirstMutualRevealCompleted(IDENTITY_A)).resolves.toBe(
      false,
    );
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("scheduleGa4Event / after()", () => {
  const originalFetch = globalThis.fetch;
  const originalMeasurement = process.env.GA4_MEASUREMENT_ID;
  const originalSecret = process.env.GA4_API_SECRET;
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    afterMock.mockImplementation((task) => {
      void Promise.resolve().then(() => task());
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMeasurement === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = originalMeasurement;
    if (originalSecret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = originalSecret;
    errorSpy.mockClear();
    afterMock.mockReset();
  });

  it("registers the send with next/server after()", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    scheduleFirstMutualRevealCompleted(IDENTITY_A);

    expect(afterMock).toHaveBeenCalledOnce();
    // Flush the mocked after() microtask.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as { client_id: string; events: { name: string }[] };
    expect(body.events[0].name).toBe("first_mutual_reveal_completed");
    expect(body.client_id).toBe(ga4ClientIdFromUserId(USER_A));
  });

  it("swallows errors from the after() task", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch;

    expect(() =>
      scheduleGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, IDENTITY_A),
    ).not.toThrow();
    expect(afterMock).toHaveBeenCalledOnce();
    await Promise.resolve();
    await Promise.resolve();
    // sendGa4Event logs; after wrapper must not rethrow into the request.
    expect(errorSpy).toHaveBeenCalled();
  });

  it("schedules invite_sent with an anonymous payload (no IDs)", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    scheduleInviteSent(IDENTITY_A);
    expect(afterMock).toHaveBeenCalledOnce();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as {
      client_id: string;
      user_id?: string;
      events: { name: string; params: Record<string, unknown> }[];
    };
    expect(body.events[0].name).toBe("invite_sent");
    expect(body.user_id).toBeUndefined();
    expect(body.client_id).toBe(ga4ClientIdFromUserId(USER_A));
    expect(JSON.stringify(body)).not.toContain(USER_A);
    // Event name contains "invite"; assert params/keys carry no entity IDs.
    expect(Object.keys(body.events[0].params)).toEqual(["engagement_time_msec"]);
    expect(JSON.stringify(body.events[0].params)).not.toMatch(
      /user_id|connection_id|invite_code/i,
    );
    expect(body.events[0].params.engagement_time_msec).toBe(1);
  });

  it("schedules partner_joined with an anonymous payload (no IDs)", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    schedulePartnerJoined(IDENTITY_A);
    expect(afterMock).toHaveBeenCalledOnce();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as {
      user_id?: string;
      events: { name: string; params: Record<string, unknown> }[];
    };
    expect(body.events[0].name).toBe("partner_joined");
    expect(body.user_id).toBeUndefined();
    expect(Object.keys(body.events[0].params)).toEqual(["engagement_time_msec"]);
  });
});
