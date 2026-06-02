import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/streak";

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-06-02", "2026-06-01", "2026-05-31"], "2026-06-02")).toBe(3);
  });

  it("allows the streak to end yesterday", () => {
    expect(computeStreak(["2026-06-01", "2026-05-31"], "2026-06-02")).toBe(2);
  });

  it("resets when neither today nor yesterday is present", () => {
    expect(computeStreak(["2026-05-30", "2026-05-29"], "2026-06-02")).toBe(0);
  });

  it("stops at the first gap", () => {
    expect(computeStreak(["2026-06-02", "2026-05-31", "2026-05-30"], "2026-06-02")).toBe(1);
  });

  it("is 0 for no data", () => {
    expect(computeStreak([], "2026-06-02")).toBe(0);
  });
});
