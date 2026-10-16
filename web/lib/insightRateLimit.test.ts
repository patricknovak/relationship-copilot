import { describe, expect, it } from "vitest";
import {
  CLAIM_TTL_MS,
  claimBlockedBy,
  claimLostRace,
  isPendingInsightPayload,
} from "./insightRateLimit";

describe("isPendingInsightPayload", () => {
  it("detects generating placeholders", () => {
    expect(isPendingInsightPayload({ status: "generating" })).toBe(true);
    expect(isPendingInsightPayload({ reflection: "hi" })).toBe(false);
    expect(isPendingInsightPayload(null)).toBe(false);
  });
});

describe("claimBlockedBy", () => {
  const now = Date.parse("2026-06-01T12:00:00Z");

  it("blocks on a completed generation in the window", () => {
    expect(
      claimBlockedBy(
        [{ payload: { reflection: "done" }, generated_at: "2026-06-01T11:55:00Z" }],
        now,
      ),
    ).toBe(true);
  });

  it("blocks on a fresh in-flight claim", () => {
    expect(
      claimBlockedBy(
        [
          {
            payload: { status: "generating" },
            generated_at: "2026-06-01T11:58:00Z",
          },
        ],
        now,
      ),
    ).toBe(true);
  });

  it("ignores stale in-flight claims older than the TTL", () => {
    const stale = new Date(now - CLAIM_TTL_MS - 1000).toISOString();
    expect(
      claimBlockedBy(
        [{ payload: { status: "generating" }, generated_at: stale }],
        now,
      ),
    ).toBe(false);
  });

  it("allows when there are no other rows", () => {
    expect(claimBlockedBy([], now)).toBe(false);
  });
});

describe("claimLostRace", () => {
  it("flags count > 1", () => {
    expect(claimLostRace(1)).toBe(false);
    expect(claimLostRace(2)).toBe(true);
  });
});
