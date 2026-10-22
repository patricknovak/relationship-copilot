import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";

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
  resetGa4ClientIdSaltWarningForTests,
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
const SALT = "test-salt-do-not-use-in-prod";

function expectedHmacId(userId: string, salt = SALT): string {
  const hex = createHmac("sha256", salt).update(userId, "utf8").digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const IDENTITY_A = {
  userId: USER_A,
  analyticsConsent: "granted" as const,
};

describe("isConnectionFirstReveal", () => {
  it("is true only for the first revealed instance", () => {
    expect(isConnectionFirstReveal(0)).toBe(false);
    expect(isConnectionFirstReveal(1)).toBe(true);
    expect(isConnectionFirstReveal(2)).toBe(false);
  });
});

describe("shouldTrackFirstMutualReveal / shouldTrackFunnelStep", () => {
  it("is true only when the DB claim was granted", () => {
    expect(shouldTrackFirstMutualReveal(true)).toBe(true);
    expect(shouldTrackFirstMutualReveal(false)).toBe(false);
    expect(shouldTrackFunnelStep(true)).toBe(true);
    expect(shouldTrackFunnelStep(false)).toBe(false);
  });
});

describe("funnel event names", () => {
  it("uses the exact activation funnel event names", () => {
    expect(FIRST_MUTUAL_REVEAL_COMPLETED).toBe("first_mutual_reveal_completed");
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

describe("ga4ClientIdFromUserId (HMAC)", () => {
  const originalSalt = process.env.GA4_CLIENT_ID_SALT;
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    resetGa4ClientIdSaltWarningForTests();
    warnSpy.mockClear();
    process.env.GA4_CLIENT_ID_SALT = SALT;
  });

  afterEach(() => {
    if (originalSalt === undefined) delete process.env.GA4_CLIENT_ID_SALT;
    else process.env.GA4_CLIENT_ID_SALT = originalSalt;
  });

  it("returns the same id for the same user and salt", () => {
    expect(ga4ClientIdFromUserId(USER_A)).toBe(ga4ClientIdFromUserId(USER_A));
    expect(ga4ClientIdFromUserId(USER_A)).toBe(expectedHmacId(USER_A));
  });

  it("returns different ids for different users", () => {
    expect(ga4ClientIdFromUserId(USER_A)).not.toBe(ga4ClientIdFromUserId(USER_B));
  });

  it("returns null and warns once when salt is missing (no plain-hash fallback)", () => {
    delete process.env.GA4_CLIENT_ID_SALT;
    expect(ga4ClientIdFromUserId(USER_A)).toBeNull();
    expect(ga4ClientIdFromUserId(USER_A)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toMatch(/GA4_CLIENT_ID_SALT/);
  });

  it("never embeds the raw user id", () => {
    const id = ga4ClientIdFromUserId(USER_A)!;
    expect(id).not.toContain(USER_A);
    expect(id.toLowerCase()).not.toContain(
      USER_A.replace(/-/g, "").toLowerCase(),
    );
  });

  it("prefers a consented browser client_id when passed through", () => {
    const browser = "1234567890.0987654321";
    expect(
      resolveGa4ClientId({
        userId: USER_A,
        analyticsConsent: "granted",
        browserClientId: browser,
      }),
    ).toBe(browser);
  });

  it("ignores browser client_id without granted consent", () => {
    const browser = "1234567890.0987654321";
    expect(
      resolveGa4ClientId({
        userId: USER_A,
        analyticsConsent: "denied",
        browserClientId: browser,
      }),
    ).toBe(expectedHmacId(USER_A));
  });
});

describe("sendGa4Event consent + salt gates", () => {
  const originalFetch = globalThis.fetch;
  const originalMeasurement = process.env.GA4_MEASUREMENT_ID;
  const originalSecret = process.env.GA4_API_SECRET;
  const originalSalt = process.env.GA4_CLIENT_ID_SALT;
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    resetGa4ClientIdSaltWarningForTests();
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    process.env.GA4_CLIENT_ID_SALT = SALT;
    errorSpy.mockClear();
    warnSpy.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMeasurement === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = originalMeasurement;
    if (originalSecret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = originalSecret;
    if (originalSalt === undefined) delete process.env.GA4_CLIENT_ID_SALT;
    else process.env.GA4_CLIENT_ID_SALT = originalSalt;
    vi.clearAllMocks();
  });

  it("sends nothing when salt is missing", async () => {
    delete process.env.GA4_CLIENT_ID_SALT;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(
      sendGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, IDENTITY_A),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("sends nothing when consent is denied", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(
      sendGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, {
        userId: USER_A,
        analyticsConsent: "denied",
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing when consent is unknown", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(
      sendGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, {
        userId: USER_A,
        analyticsConsent: null,
      }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends with HMAC client_id when consent is granted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(trackFirstMutualRevealCompleted(IDENTITY_A)).resolves.toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as {
      client_id: string;
      non_personalized_ads: boolean;
      events: { name: string; params: Record<string, unknown> }[];
    };
    expect(body.client_id).toBe(expectedHmacId(USER_A));
    expect(body.non_personalized_ads).toBe(true);
    expect(body.events[0].name).toBe("first_mutual_reveal_completed");
    const blob = JSON.stringify(body);
    expect(blob).not.toContain(USER_A);
    expect(blob).not.toMatch(/@|email|display_name|full_name|user_id/i);
  });

  it("reuses the same HMAC id across funnel events for one user + salt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    for (const name of [
      SIGN_UP_COMPLETED,
      INVITE_SENT,
      PARTNER_JOINED,
      FIRST_QUESTION_ANSWERED,
      "answered_before_join",
      FIRST_MUTUAL_REVEAL_COMPLETED,
    ]) {
      await sendGa4Event(name, {}, IDENTITY_A);
    }

    const ids = fetchMock.mock.calls.map((call) => {
      const body = JSON.parse(
        String((call as [string, RequestInit])[1].body),
      ) as { client_id: string };
      return body.client_id;
    });
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(expectedHmacId(USER_A));
  });

  it("no-ops when Measurement Protocol credentials are unset", async () => {
    delete process.env.GA4_MEASUREMENT_ID;
    delete process.env.GA4_API_SECRET;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(
      sendGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, IDENTITY_A),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("scheduleGa4Event / after()", () => {
  const originalFetch = globalThis.fetch;
  const originalMeasurement = process.env.GA4_MEASUREMENT_ID;
  const originalSecret = process.env.GA4_API_SECRET;
  const originalSalt = process.env.GA4_CLIENT_ID_SALT;
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    afterMock.mockImplementation((task) => {
      void Promise.resolve().then(() => task());
    });
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    process.env.GA4_CLIENT_ID_SALT = SALT;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMeasurement === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = originalMeasurement;
    if (originalSecret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = originalSecret;
    if (originalSalt === undefined) delete process.env.GA4_CLIENT_ID_SALT;
    else process.env.GA4_CLIENT_ID_SALT = originalSalt;
    errorSpy.mockClear();
    afterMock.mockReset();
  });

  it("registers the send with next/server after() when consent is granted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    scheduleFirstMutualRevealCompleted(IDENTITY_A);
    expect(afterMock).toHaveBeenCalledOnce();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body),
    ) as { client_id: string; events: { name: string }[] };
    expect(body.events[0].name).toBe("first_mutual_reveal_completed");
    expect(body.client_id).toBe(expectedHmacId(USER_A));
  });

  it("does not fetch when consent is unknown (cron / other partner)", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    scheduleGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED, {}, {
      userId: USER_A,
      analyticsConsent: null,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
