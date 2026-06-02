import { describe, it, expect } from "vitest";
import { zodiacCompatibility } from "@/lib/compat";

describe("zodiacCompatibility", () => {
  it("returns null when a birthday is missing", () => {
    expect(zodiacCompatibility(null, "1990-04-01")).toBeNull();
    expect(zodiacCompatibility("1990-04-01", undefined)).toBeNull();
  });

  it("same element → high", () => {
    // Aries (Fire) & Leo (Fire)
    const r = zodiacCompatibility("1990-04-01", "1990-08-01");
    expect(r?.level).toBe("high");
  });

  it("Fire + Water → low", () => {
    // Aries (Fire) & Cancer (Water)
    const r = zodiacCompatibility("1990-04-01", "1990-07-01");
    expect(r?.level).toBe("low");
  });

  it("Fire + Earth → medium", () => {
    // Aries (Fire) & Taurus (Earth)
    const r = zodiacCompatibility("1990-04-01", "1990-05-01");
    expect(r?.level).toBe("medium");
  });
});
