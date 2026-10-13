import { describe, expect, it } from "vitest";
import type { PromptQuestion } from "@/lib/database.types";
import {
  dimensionLabel,
  isDimensionScored,
  quizReflection,
  scoreDimensions,
} from "./quizResult";

const QS: PromptQuestion[] = [
  { id: "q1", text: "a", format: "scale", min: 1, max: 5, dimension: "anxiety" },
  { id: "q2", text: "b", format: "scale", min: 1, max: 5, dimension: "avoidance" },
  { id: "q3", text: "c", format: "scale", min: 1, max: 5, dimension: "anxiety" },
  { id: "q4", text: "d", format: "free_text" },
];

describe("scoreDimensions", () => {
  it("averages scale answers per dimension and ignores the rest", () => {
    const s = scoreDimensions(QS, { q1: "4", q2: "2", q3: "5", q4: "words" });
    expect(s).toEqual([
      { dimension: "anxiety", average: 4.5, max: 5, count: 2 },
      { dimension: "avoidance", average: 2, max: 5, count: 1 },
    ]);
  });

  it("skips blank or non-numeric answers", () => {
    expect(scoreDimensions(QS, { q1: "", q2: "x" })).toEqual([]);
  });
});

describe("quizReflection", () => {
  it("labels the attachment pair with the profile thresholds", () => {
    expect(quizReflection(QS, { q1: "4", q2: "2", q3: "5" })?.label).toBe("Anxious");
    expect(quizReflection(QS, { q1: "2", q2: "4", q3: "2" })?.label).toBe("Avoidant");
    expect(quizReflection(QS, { q1: "4", q2: "4", q3: "4" })?.label).toBe("Fearful");
    const secure = quizReflection(QS, { q1: "2", q2: "2", q3: "3" });
    expect(secure?.label).toBe("Secure");
    expect(secure?.blurb).toMatch(/comfortable/);
  });

  it("returns null when nothing is scorable, and no label for other dimensions", () => {
    expect(quizReflection(QS, {})).toBeNull();
    const other: PromptQuestion[] = [
      { id: "q1", text: "a", format: "scale", min: 1, max: 10, dimension: "trust" },
    ];
    const r = quizReflection(other, { q1: "7" });
    expect(r?.scores[0]).toEqual({ dimension: "trust", average: 7, max: 10, count: 1 });
    expect(r?.label).toBeNull();
  });
});

describe("helpers", () => {
  it("detects dimension-scored configs and labels dimensions", () => {
    expect(isDimensionScored({ scoring: "dimensions" })).toBe(true);
    expect(isDimensionScored({ scoring: "reflection" })).toBe(false);
    expect(isDimensionScored(null)).toBe(false);
    expect(dimensionLabel("psychological_safety")).toBe("Psychological safety");
  });
});
