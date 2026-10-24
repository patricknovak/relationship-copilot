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
  isConnectionFirstReveal,
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
    expect(() => scheduleSignUpCompleted()).not.toThrow();
    expect(() => scheduleInviteSent()).not.toThrow();
    expect(() => schedulePartnerJoined()).not.toThrow();
    expect(() => scheduleFirstQuestionAnswered()).not.toThrow();
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
    vi.clearAllMocks();
  });

  it("never calls fetch (disabled until consent-gated sending, PR #137)", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(sendGa4Event("first_mutual_reveal_completed")).resolves.toBe(
      false,
    );
    await expect(trackFirstMutualRevealCompleted()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
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
});

describe("scheduleGa4Event / after()", () => {
  const originalFetch = globalThis.fetch;
  const originalMeasurement = process.env.GA4_MEASUREMENT_ID;
  const originalSecret = process.env.GA4_API_SECRET;

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
    afterMock.mockReset();
  });

  it("registers with after() but never fetches (disabled until PR #137)", async () => {
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as typeof fetch;

    scheduleFirstMutualRevealCompleted();
    scheduleInviteSent();
    schedulePartnerJoined();
    expect(() => scheduleGa4Event(FIRST_MUTUAL_REVEAL_COMPLETED)).not.toThrow();

    expect(afterMock).toHaveBeenCalledTimes(4);
    // Flush the mocked after() microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
