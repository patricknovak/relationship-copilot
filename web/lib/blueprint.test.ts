import { describe, it, expect } from "vitest";
import { parseBlueprint } from "@/lib/blueprint";

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
