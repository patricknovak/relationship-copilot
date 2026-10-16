import { describe, expect, it } from "vitest";
import { othersAnsweredSet } from "./othersHaveAnswered";

describe("othersAnsweredSet", () => {
  it("collects only true flags", () => {
    expect(
      othersAnsweredSet([
        { instance_id: "a", answered: true },
        { instance_id: "b", answered: false },
        { instance_id: "c", answered: true },
      ]),
    ).toEqual(new Set(["a", "c"]));
  });

  it("handles empty / null input", () => {
    expect(othersAnsweredSet(null).size).toBe(0);
    expect(othersAnsweredSet(undefined).size).toBe(0);
    expect(othersAnsweredSet([]).size).toBe(0);
  });
});
