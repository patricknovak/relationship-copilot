import { describe, expect, it } from "vitest";
import { pickWeeklySuggestion, weekIndex } from "./suggestion";

const T = [
  { id: "b", kind: "quiz", title: "B", description: null },
  { id: "a", kind: "challenge", title: "A", description: "x" },
  { id: "c", kind: "quiz", title: "C", description: null },
];

describe("pickWeeklySuggestion", () => {
  it("skips started templates and is stable within a week", () => {
    const started = new Set<string | null>(["a"]);
    const d1 = pickWeeklySuggestion(T, started, "2026-10-12");
    const d2 = pickWeeklySuggestion(T, started, "2026-10-14");
    expect(d1).not.toBeNull();
    expect(d1?.id).not.toBe("a");
    expect(d2?.id).toBe(d1?.id);
  });

  it("rotates across weeks and returns null when everything is done", () => {
    const seen = new Set<string>();
    for (const day of ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22"]) {
      seen.add(pickWeeklySuggestion(T, new Set(), day)!.id);
    }
    expect(seen.size).toBe(3);
    expect(pickWeeklySuggestion(T, new Set(["a", "b", "c"]), "2026-10-01")).toBeNull();
  });

  it("weekIndex handles bad input", () => {
    expect(weekIndex("nope")).toBe(0);
    expect(weekIndex("2026-10-15") - weekIndex("2026-10-08")).toBe(1);
  });
});
