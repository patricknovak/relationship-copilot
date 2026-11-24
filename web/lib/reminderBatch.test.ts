import { describe, expect, it } from "vitest";
import { onePerRecipientInWindow } from "./reminderBatch";

// 2026-11-24 18:00 UTC: 13:00 in New York, 03:00 in Tokyo (next day).
const NOW = new Date("2026-11-24T18:00:00Z");
const pick = (recipient_id: string, timezone: string | null = "America/New_York", n = 0) => ({
  recipient_id,
  timezone,
  n,
});

describe("onePerRecipientInWindow", () => {
  it("sends one per recipient however many sets are waiting", () => {
    const taken = new Set<string>();
    const batch = onePerRecipientInWindow(
      [pick("a", undefined, 1), pick("a", undefined, 2), pick("b"), pick("a", undefined, 3)],
      NOW,
      9,
      20,
      taken,
    );
    expect(batch.send.map((p) => [p.recipient_id, p.n])).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
    expect(batch.held).toBe(2);
    expect(batch.outsideWindow).toBe(0);
    expect([...taken].sort()).toEqual(["a", "b"]);
  });

  it("holds back anyone already nudged (earlier job or recent log)", () => {
    const taken = new Set(["a"]);
    const batch = onePerRecipientInWindow([pick("a"), pick("b")], NOW, 9, 20, taken);
    expect(batch.send.map((p) => p.recipient_id)).toEqual(["b"]);
    expect(batch.held).toBe(1);
  });

  it("skips night-time connections without marking the recipient as taken", () => {
    const taken = new Set<string>();
    const batch = onePerRecipientInWindow([pick("a", "Asia/Tokyo"), pick("a")], NOW, 9, 20, taken);
    expect(batch.outsideWindow).toBe(1);
    // The same person's daytime connection still goes.
    expect(batch.send).toHaveLength(1);
  });

  it("treats a missing or bad time zone as UTC", () => {
    const batch = onePerRecipientInWindow(
      [pick("a", null), pick("b", "Not/AZone")],
      NOW,
      9,
      20,
      new Set(),
    );
    expect(batch.send).toHaveLength(2);
    const night = onePerRecipientInWindow([pick("a", null)], new Date("2026-11-24T03:00:00Z"), 9, 20, new Set());
    expect(night.outsideWindow).toBe(1);
  });

  it("includes both window edges", () => {
    const at = (h: string) => new Date(`2026-11-24T${h}:30:00Z`);
    expect(onePerRecipientInWindow([pick("a", "UTC")], at("09"), 9, 20, new Set()).send).toHaveLength(1);
    expect(onePerRecipientInWindow([pick("a", "UTC")], at("20"), 9, 20, new Set()).send).toHaveLength(1);
    expect(onePerRecipientInWindow([pick("a", "UTC")], at("21"), 9, 20, new Set()).send).toHaveLength(0);
    expect(onePerRecipientInWindow([pick("a", "UTC")], at("08"), 9, 20, new Set()).send).toHaveLength(0);
  });
});
