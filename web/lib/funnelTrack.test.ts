import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const afterMock = vi.fn<(task: () => unknown | Promise<unknown>) => void>();

vi.mock("next/server", () => ({
  after: (task: () => unknown | Promise<unknown>) => afterMock(task),
}));

import {
  FIRST_QUESTION_ANSWERED,
  SIGN_UP_COMPLETED,
} from "./ga4";
import {
  claimAndTrackFirstQuestionAnswered,
  claimAndTrackUserFunnelStep,
} from "./funnelTrack";

function mockRpc(result: {
  data: boolean | null;
  error: { message: string } | null;
}) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  };
}

describe("claimAndTrackUserFunnelStep", () => {
  const originalFetch = globalThis.fetch;
  const originalMeasurement = process.env.GA4_MEASUREMENT_ID;
  const originalSecret = process.env.GA4_API_SECRET;
  const originalSalt = process.env.GA4_CLIENT_ID_SALT;
  const userId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    afterMock.mockReset();
    afterMock.mockImplementation((task) => {
      void Promise.resolve(task());
    });
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    process.env.GA4_CLIENT_ID_SALT = "test-salt";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMeasurement === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = originalMeasurement;
    if (originalSecret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = originalSecret;
    if (originalSalt === undefined) delete process.env.GA4_CLIENT_ID_SALT;
    else process.env.GA4_CLIENT_ID_SALT = originalSalt;
  });

  it("schedules sign_up_completed when the claim wins and consent is granted", async () => {
    const supabase = mockRpc({ data: true, error: null });
    await claimAndTrackUserFunnelStep(
      supabase as never,
      SIGN_UP_COMPLETED,
      userId,
      "granted",
    );
    expect(supabase.rpc).toHaveBeenCalledWith("claim_user_funnel_step", {
      p_step: SIGN_UP_COMPLETED,
    });
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const body = JSON.parse(
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1].body as string,
    );
    expect(body.events[0].name).toBe("sign_up_completed");
    expect(body.non_personalized_ads).toBe(true);
    expect(JSON.stringify(body)).not.toContain(userId);
  });

  it("claims but does not send when consent is unknown", async () => {
    const supabase = mockRpc({ data: true, error: null });
    await claimAndTrackUserFunnelStep(
      supabase as never,
      SIGN_UP_COMPLETED,
      userId,
      null,
    );
    expect(supabase.rpc).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does not send when the claim loses", async () => {
    const supabase = mockRpc({ data: false, error: null });
    await claimAndTrackUserFunnelStep(
      supabase as never,
      SIGN_UP_COMPLETED,
      userId,
      "granted",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("swallows RPC errors", async () => {
    const supabase = mockRpc({
      data: null,
      error: { message: "relation missing" },
    });
    await expect(
      claimAndTrackUserFunnelStep(
        supabase as never,
        SIGN_UP_COMPLETED,
        userId,
        "granted",
      ),
    ).resolves.toBeUndefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("claimAndTrackFirstQuestionAnswered", () => {
  const originalFetch = globalThis.fetch;
  const originalMeasurement = process.env.GA4_MEASUREMENT_ID;
  const originalSecret = process.env.GA4_API_SECRET;
  const originalSalt = process.env.GA4_CLIENT_ID_SALT;

  beforeEach(() => {
    afterMock.mockReset();
    afterMock.mockImplementation((task) => {
      void Promise.resolve(task());
    });
    process.env.GA4_MEASUREMENT_ID = "G-3HE7V5FTSR";
    process.env.GA4_API_SECRET = "test-secret";
    process.env.GA4_CLIENT_ID_SALT = "test-salt";
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMeasurement === undefined) delete process.env.GA4_MEASUREMENT_ID;
    else process.env.GA4_MEASUREMENT_ID = originalMeasurement;
    if (originalSecret === undefined) delete process.env.GA4_API_SECRET;
    else process.env.GA4_API_SECRET = originalSecret;
    if (originalSalt === undefined) delete process.env.GA4_CLIENT_ID_SALT;
    else process.env.GA4_CLIENT_ID_SALT = originalSalt;
  });

  it("schedules first_question_answered when the claim wins and consent is granted", async () => {
    const supabase = mockRpc({ data: true, error: null });
    const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await claimAndTrackFirstQuestionAnswered(
      supabase as never,
      "11111111-1111-1111-1111-111111111111",
      userId,
      "granted",
    );
    expect(supabase.rpc).toHaveBeenCalledWith("claim_funnel_step", {
      p_connection_id: "11111111-1111-1111-1111-111111111111",
      p_step: FIRST_QUESTION_ANSWERED,
    });
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const body = JSON.parse(
      (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][1].body as string,
    );
    expect(body.events[0].name).toBe("first_question_answered");
    expect(JSON.stringify(body)).not.toContain(userId);
  });
});
