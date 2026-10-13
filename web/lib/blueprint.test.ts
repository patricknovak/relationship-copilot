import { describe, it, expect } from "vitest";
import { blueprintUserPrompt, MAX_RECENT_FOR_BLUEPRINT, parseBlueprint } from "@/lib/blueprint";

describe("parseBlueprint", () => {
  it("parses well-formed JSON", () => {
    const bp = parseBlueprint(
      JSON.stringify({
        strengths: ["warmth", "humor"],
        shared_goals: ["weekly check-in"],
        focus_areas: ["listening"],
        reflection: "You clearly care about each other.",
      }),
    );
    expect(bp.strengths).toEqual(["warmth", "humor"]);
    expect(bp.reflection).toContain("care");
  });

  it("extracts JSON when wrapped in prose", () => {
    const bp = parseBlueprint('Sure!\n{"strengths":["trust"]}\nHope that helps.');
    expect(bp.strengths).toEqual(["trust"]);
    expect(bp.shared_goals).toEqual([]);
  });

  it("degrades gracefully on garbage", () => {
    const bp = parseBlueprint("not json at all");
    expect(bp).toEqual({ strengths: [], shared_goals: [], focus_areas: [], reflection: "" });
  });

  it("filters non-string array entries", () => {
    const bp = parseBlueprint('{"strengths":["ok",2,null,"good"]}');
    expect(bp.strengths).toEqual(["ok", "good"]);
  });
});

describe("blueprintUserPrompt", () => {
  const qa = [{ question: "Q?", p1: "a", p2: "b" }];

  it("omits the recent section when there is nothing recent", () => {
    const m = blueprintUserPrompt("romantic", qa);
    expect(m.content).toContain("Q1: Q?");
    expect(m.content).not.toContain("most recent daily answers");
  });

  it("appends recent dailies with dates and caps them", () => {
    const recent = Array.from({ length: MAX_RECENT_FOR_BLUEPRINT + 5 }, (_, i) => ({
      question: `R${i}`,
      p1: "x",
      p2: "y",
      date: "2026-10-01",
    }));
    const m = blueprintUserPrompt("friend", qa, recent);
    expect(m.content).toContain("most recent daily answers");
    expect(m.content).toContain("(2026-10-01)");
    expect(m.content).not.toContain("R0:"); // oldest beyond the cap dropped
    expect(m.content).toContain(`R${MAX_RECENT_FOR_BLUEPRINT + 4}`);
    expect(m.content).not.toContain("P3");
  });
});
