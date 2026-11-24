import { describe, it, expect } from "vitest";
import { detectSafetySignals, isElevatedFlag, normalizeForSafety } from "@/lib/safety";

describe("detectSafetySignals", () => {
  it("returns none for ordinary content", () => {
    const s = detectSafetySignals("We had a lovely weekend hiking together.");
    expect(s.severity).toBe("none");
    expect(s.categories).toEqual([]);
  });

  it("flags self-harm as high", () => {
    const s = detectSafetySignals("Sometimes I feel like I want to die.");
    expect(s.severity).toBe("high");
    expect(s.categories).toContain("self_harm");
  });

  it("flags violence as high", () => {
    const s = detectSafetySignals("When we argue he hits me and I get scared.");
    expect(s.severity).toBe("high");
    expect(s.categories).toContain("violence");
  });

  it("flags controlling behavior (abuse) high", () => {
    const s = detectSafetySignals("He won't let me see my friends and controls everything.");
    expect(s.severity).toBe("high");
    expect(s.categories).toContain("abuse");
  });

  it("treats put-downs as elevated, not high", () => {
    const s = detectSafetySignals("She yells at me a lot when stressed.");
    expect(s.severity).toBe("elevated");
    expect(s.categories).toContain("abuse");
  });

  it("flags threats involving children or leaving as high abuse", () => {
    const s = detectSafetySignals("He threatens to take the kids if I bring it up.");
    expect(s.severity).toBe("high");
    expect(s.categories).toContain("abuse");
  });

  it("flags physical violence variants as high", () => {
    const s = detectSafetySignals("Last month she slapped me during an argument.");
    expect(s.severity).toBe("high");
    expect(s.categories).toContain("violence");
  });

  it("treats coercive-control language as elevated", () => {
    expect(detectSafetySignals("I feel like I'm walking on eggshells.").severity).toBe("elevated");
    expect(detectSafetySignals("He checks my phone every night.").severity).toBe("elevated");
    expect(detectSafetySignals("It feels like gaslighting sometimes.").severity).toBe("elevated");
  });

  it("does not flag the word controller or benign mentions", () => {
    const s = detectSafetySignals("We argued about the game controller and made up.");
    expect(s.severity).toBe("none");
  });
});

describe("normalizeForSafety", () => {
  it("straightens phone punctuation and collapses spacing and case", () => {
    expect(normalizeForSafety("I DON’T  want\u200B to\nbe here")).toBe("i don't want to be here");
  });

  it("catches disclosures typed with curly apostrophes", () => {
    expect(detectSafetySignals("I don’t want to live like this").severity).toBe("high");
    expect(detectSafetySignals("He won’t let me leave the house").severity).toBe("high");
  });
});

describe("ambiguous verbs (decision 1b)", () => {
  it("are elevated on their own, so the regex alone never withholds for them", () => {
    for (const t of ["It hurt me when she laughed.", "He pushed me to be braver.", "She grabbed me a coffee."]) {
      expect(detectSafetySignals(t)).toEqual({ severity: "elevated", categories: ["violence"] });
    }
  });

  it("stay high when the sentence is plainly physical", () => {
    for (const t of ["He badly hurt me.", "She pushed me against the wall.", "He grabs me by the arm."]) {
      expect(detectSafetySignals(t).severity).toBe("high");
    }
  });
});

describe("isElevatedFlag", () => {
  it("is true only for a stored elevated screen", () => {
    expect(isElevatedFlag({ severity: "elevated", categories: ["abuse"] })).toBe(true);
    expect(isElevatedFlag({ severity: "high" })).toBe(false);
    expect(isElevatedFlag({ severity: "none" })).toBe(false);
    expect(isElevatedFlag(null)).toBe(false);
    expect(isElevatedFlag(["elevated"])).toBe(false);
    expect(isElevatedFlag("elevated")).toBe(false);
  });
});
