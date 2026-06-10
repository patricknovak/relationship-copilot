import { describe, it, expect } from "vitest";
import {
  parseSafetyClassification,
  combineSignals,
} from "@/lib/safetyClassifier";

describe("parseSafetyClassification", () => {
  it("parses a valid verdict", () => {
    expect(
      parseSafetyClassification('{"severity":"high","categories":["abuse"]}'),
    ).toEqual({ severity: "high", categories: ["abuse"] });
  });

  it("extracts JSON wrapped in prose", () => {
    expect(
      parseSafetyClassification(
        'Here is my verdict: {"severity":"elevated","categories":["self_harm"]}',
      ),
    ).toEqual({ severity: "elevated", categories: ["self_harm"] });
  });

  it("normalizes none to an empty category list", () => {
    expect(
      parseSafetyClassification('{"severity":"none","categories":["abuse"]}'),
    ).toEqual({ severity: "none", categories: [] });
  });

  it("drops unknown categories and rejects empty non-none verdicts", () => {
    expect(
      parseSafetyClassification('{"severity":"high","categories":["spam"]}'),
    ).toBeNull();
    expect(
      parseSafetyClassification(
        '{"severity":"high","categories":["spam","violence"]}',
      ),
    ).toEqual({ severity: "high", categories: ["violence"] });
  });

  it("rejects malformed output", () => {
    expect(parseSafetyClassification("not json")).toBeNull();
    expect(parseSafetyClassification('{"severity":"catastrophic"}')).toBeNull();
    expect(parseSafetyClassification('["high"]')).toBeNull();
  });
});

describe("combineSignals", () => {
  it("keeps the regex result when the model has no opinion", () => {
    const fast = { severity: "elevated" as const, categories: ["abuse" as const] };
    expect(combineSignals(fast, null)).toEqual(fast);
  });

  it("lets the model escalate severity", () => {
    expect(
      combineSignals(
        { severity: "none", categories: [] },
        { severity: "high", categories: ["self_harm"] },
      ),
    ).toEqual({ severity: "high", categories: ["self_harm"] });
  });

  it("never lets the model downgrade the regex verdict", () => {
    expect(
      combineSignals(
        { severity: "elevated", categories: ["abuse"] },
        { severity: "none", categories: [] },
      ),
    ).toEqual({ severity: "elevated", categories: ["abuse"] });
  });

  it("unions categories", () => {
    expect(
      combineSignals(
        { severity: "elevated", categories: ["abuse"] },
        { severity: "high", categories: ["violence"] },
      ),
    ).toEqual({ severity: "high", categories: ["abuse", "violence"] });
  });
});
