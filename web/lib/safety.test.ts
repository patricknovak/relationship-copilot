import { describe, it, expect } from "vitest";
import { detectSafetySignals } from "@/lib/safety";

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
});
