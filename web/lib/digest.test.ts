import { describe, it, expect } from "vitest";
import { parseDigest, digestUserPrompt } from "@/lib/digest";

describe("parseDigest", () => {
  it("parses a complete digest", () => {
    const d = parseDigest(
      JSON.stringify({
        highlights: ["You both named the same favorite memory"],
        appreciations: ["P1 noticed P2's effort with the kids"],
        gentle_suggestion: "Try a six-minute check-in at handoff.",
        reflection: "A steady week.",
      }),
    );
    expect(d.highlights).toHaveLength(1);
    expect(d.gentle_suggestion).toMatch(/six-minute/);
  });

  it("extracts JSON wrapped in prose and coerces bad fields", () => {
    const d = parseDigest(
      'Sure! {"highlights":["a", 3],"appreciations":"nope","gentle_suggestion":null,"reflection":"ok"}',
    );
    expect(d.highlights).toEqual(["a"]);
    expect(d.appreciations).toEqual([]);
    expect(d.gentle_suggestion).toBe("");
    expect(d.reflection).toBe("ok");
  });

  it("degrades to empty defaults on garbage", () => {
    const d = parseDigest("model fell over");
    expect(d).toEqual({
      highlights: [],
      appreciations: [],
      gentle_suggestion: "",
      reflection: "",
    });
  });
});

describe("digestUserPrompt", () => {
  it("includes titles, questions, and both redacted answers", () => {
    const msg = digestUserPrompt("romantic", [
      { title: "Daily question", question: "High of the day?", p1: "the park", p2: "" },
    ]);
    expect(msg.content).toContain("[Daily question] High of the day?");
    expect(msg.content).toContain("P1: the park");
    expect(msg.content).toContain("P2: (no answer)");
  });
});
