import { describe, expect, it } from "vitest";
import { electiveCta, openElectiveRun } from "./electives";

describe("openElectiveRun", () => {
  const run = (id: string, template_id: string, status: string, created_at: string) => ({
    id,
    template_id,
    status,
    created_at,
  });

  it("finds the run the other person already started", () => {
    // One person starts a quiz and answers; the other taps Start on the same
    // quiz. They must land in the same run, not a second one.
    const runs = [run("r1", "quiz-a", "open", "2026-11-20T10:00:00Z")];
    expect(openElectiveRun(runs, "quiz-a")?.id).toBe("r1");
  });

  it("ignores finished runs and other templates, so a redo starts fresh", () => {
    const runs = [
      run("done", "quiz-a", "revealed", "2026-11-18T10:00:00Z"),
      run("other", "quiz-b", "open", "2026-11-20T10:00:00Z"),
    ];
    expect(openElectiveRun(runs, "quiz-a")).toBeNull();
    expect(openElectiveRun([], "quiz-a")).toBeNull();
    expect(openElectiveRun(null, "quiz-a")).toBeNull();
  });

  it("picks the newest when older duplicates already exist", () => {
    const runs = [
      run("old", "quiz-a", "open", "2026-11-19T10:00:00Z"),
      run("new", "quiz-a", "open", "2026-11-21T10:00:00Z"),
    ];
    expect(openElectiveRun(runs, "quiz-a")?.id).toBe("new");
  });
});

describe("electiveCta", () => {
  it("offers to continue a run in progress instead of starting another", () => {
    expect(electiveCta("open")).toBe("Continue");
    expect(electiveCta("revealed")).toBe("Do it again");
    expect(electiveCta(undefined)).toBe("Start");
  });
});
