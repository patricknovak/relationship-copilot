import { describe, it, expect } from "vitest";
import { pickRetrospectives } from "@/lib/retrospective";

const today = "2026-06-10";

describe("pickRetrospectives", () => {
  it("returns nothing when there is no history near the targets", () => {
    expect(
      pickRetrospectives(
        [{ id: "a", scheduled_for: "2026-06-09" }],
        today,
      ),
    ).toEqual([]);
  });

  it("picks the closest instance to a month ago within tolerance", () => {
    const picks = pickRetrospectives(
      [
        { id: "a", scheduled_for: "2026-05-09" }, // -32d
        { id: "b", scheduled_for: "2026-05-12" }, // -29d (closer)
        { id: "c", scheduled_for: "2026-05-01" }, // -40d (out of tolerance)
      ],
      today,
    );
    expect(picks).toEqual([
      { id: "b", scheduled_for: "2026-05-12", label: "About a month ago" },
    ]);
  });

  it("picks a year-ago instance with wider tolerance", () => {
    const picks = pickRetrospectives(
      [{ id: "y", scheduled_for: "2025-06-15" }], // ~360d ago
      today,
    );
    expect(picks).toEqual([
      { id: "y", scheduled_for: "2025-06-15", label: "A year ago" },
    ]);
  });

  it("returns both when both exist, year first, without reusing an instance", () => {
    const picks = pickRetrospectives(
      [
        { id: "y", scheduled_for: "2025-06-10" },
        { id: "m", scheduled_for: "2026-05-11" },
      ],
      today,
    );
    expect(picks.map((p) => p.label)).toEqual(["A year ago", "About a month ago"]);
    expect(new Set(picks.map((p) => p.id)).size).toBe(2);
  });
});
