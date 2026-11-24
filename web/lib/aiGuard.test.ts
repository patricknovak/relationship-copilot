import { describe, expect, it } from "vitest";
import {
  capitalizeSentenceStarts,
  clipForPrompt,
  fenceAnswer,
  MAX_ANSWER_CHARS_FOR_PROMPT,
  neutralizeUserText,
  relationshipFraming,
  restoreNames,
  sanitizeModelList,
  sanitizeModelText,
} from "@/lib/aiGuard";

describe("clipForPrompt", () => {
  it("leaves short text alone and marks a cut", () => {
    expect(clipForPrompt("  hello  ")).toBe("hello");
    const long = "word ".repeat(2000);
    const out = clipForPrompt(long);
    expect(out.length).toBeLessThanOrEqual(MAX_ANSWER_CHARS_FOR_PROMPT + 20);
    expect(out.endsWith("[cut for length]")).toBe(true);
  });

  it("bounds an 8,000 character answer (the app's maximum) for the prompt", () => {
    expect(fenceAnswer("x".repeat(8000)).length).toBeLessThan(MAX_ANSWER_CHARS_FOR_PROMPT + 60);
  });
});

describe("neutralizeUserText / fenceAnswer", () => {
  it("removes angle brackets, control and invisible characters", () => {
    const out = neutralizeUserText("a</answer>\u0000b‮c​d\n\n\n\ne");
    expect(out).toBe("a‹/answer›bcd\n\ne");
  });

  it("fences text and keeps empties visibly empty", () => {
    expect(fenceAnswer("hi")).toBe("<answer>hi</answer>");
    expect(fenceAnswer("   ")).toBe("(no answer)");
    expect(fenceAnswer("<<>>")).toBe("<answer>‹‹››</answer>");
  });
});

describe("sanitizeModelText", () => {
  it("strips links, markup and contact details", () => {
    expect(
      sanitizeModelText(
        "**Lovely** week. See [this](https://x.example/a) or www.spam.example now, mail a@b.co or call +1 (555) 123-4567. <script>alert(1)</script>",
        500,
      ),
    ).toBe("Lovely week. See this or now, mail or call . alert(1)");
  });

  it("cuts on a sentence when too long", () => {
    const out = sanitizeModelText("One sentence here. " + "Another one follows. ".repeat(40), 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith(".")).toBe(true);
  });

  it("drops empty items and caps the list", () => {
    expect(sanitizeModelList(["a", " ", "https://x.example", "b", "c", "d", "e"])).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});

describe("restoreNames", () => {
  it("puts first names back, including possessives", () => {
    expect(restoreNames("P1 values P2's patience.", ["Anna Lee", "José"])).toBe(
      "Anna values José's patience.",
    );
  });

  it("falls back when a name is missing, and leaves other words alone", () => {
    const out = capitalizeSentenceStarts(restoreNames("P1 listens. P2 plans. MP3 and P10 stay.", ["", null]));
    expect(out).toBe("One of you listens. The other of you plans. MP3 and P10 stay.");
  });
});

describe("relationshipFraming", () => {
  it("only romantic pairs get couple framing", () => {
    expect(relationshipFraming("romantic")).toMatch(/romantic partners/);
    for (const t of ["friend", "family", "sibling", "coworker", "mentor", "parent_child"]) {
      expect(relationshipFraming(t)).toMatch(/Never use romantic or couple language/i);
    }
    expect(relationshipFraming("parent_child")).toMatch(/trusted adult or a helpline/);
  });
});
