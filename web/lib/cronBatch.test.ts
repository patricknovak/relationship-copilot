import { describe, expect, it } from "vitest";
import { cronBatchSummary } from "./cronBatch";

describe("cronBatchSummary", () => {
  it("caps the batch and flags a backlog when the selector returned max+1", () => {
    const rows = [1, 2, 3, 4];
    expect(cronBatchSummary(rows, 3)).toEqual({ batch: [1, 2, 3], more: true });
    expect(cronBatchSummary(rows, 4)).toEqual({ batch: rows, more: false });
    expect(cronBatchSummary([], 100)).toEqual({ batch: [], more: false });
  });
});
