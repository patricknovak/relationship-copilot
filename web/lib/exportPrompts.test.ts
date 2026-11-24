import { describe, expect, it } from "vitest";
import { exportPrompts, type ExportInstance } from "./exportPrompts";

const inst = (over: Partial<ExportInstance> = {}): ExportInstance => ({
  id: "i1",
  connection_id: "c1",
  kind: "daily",
  status: "open",
  scheduled_for: "2026-11-19",
  questions: [{ id: "q1", text: "What made you laugh this week?", format: "text" }],
  ...over,
});

describe("exportPrompts", () => {
  it("pairs each answered instance with its question text", () => {
    expect(exportPrompts([inst()], ["i1"])).toEqual([
      {
        instance_id: "i1",
        connection_id: "c1",
        kind: "daily",
        status: "open",
        date: "2026-11-19",
        questions: [{ id: "q1", text: "What made you laugh this week?" }],
      },
    ]);
  });

  it("includes only instances the user answered", () => {
    const out = exportPrompts([inst(), inst({ id: "i2" })], ["i2"]);
    expect(out.map((p) => p.instance_id)).toEqual(["i2"]);
  });

  it("does not export the first set's sentinel date as a real day", () => {
    const [p] = exportPrompts(
      [inst({ kind: "onboarding", scheduled_for: "2000-01-01" })],
      ["i1"],
    );
    expect(p.date).toBeNull();
  });

  it("tolerates missing or malformed question lists", () => {
    expect(exportPrompts(null, ["i1"])).toEqual([]);
    expect(exportPrompts([inst({ questions: null })], ["i1"])[0].questions).toEqual([]);
    expect(
      exportPrompts([inst({ questions: [null, "x", { id: 1, text: "n" }, { id: "q2", text: "ok" }] })], ["i1"])[0]
        .questions,
    ).toEqual([{ id: "q2", text: "ok" }]);
  });
});
