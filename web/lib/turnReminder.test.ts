import { describe, expect, it } from "vitest";
import { pickTurnReminders } from "./turnReminder";

const now = new Date("2026-10-17T15:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
const members = new Map([
  ["c1", ["a", "b"]],
  ["c2", ["a"]],
]);

describe("pickTurnReminders", () => {
  it("nudges the one person still to answer after 36 hours", () => {
    const out = pickTurnReminders({
      instances: [{ id: "i1", connection_id: "c1", kind: "onboarding", status: "open" }],
      membersByConnection: members,
      responses: [{ instance_id: "i1", user_id: "a", submitted_at: hoursAgo(40) }],
      now,
    });
    expect(out).toEqual([{ instanceId: "i1", connectionId: "c1", recipientId: "b", answeredById: "a" }]);
  });

  it("waits until 36 hours and gives up after a week", () => {
    for (const h of [10, 35.9, 24 * 7 + 1]) {
      expect(
        pickTurnReminders({
          instances: [{ id: "i1", connection_id: "c1", kind: "quiz", status: "open" }],
          membersByConnection: members,
          responses: [{ instance_id: "i1", user_id: "a", submitted_at: hoursAgo(h) }],
          now,
        }),
      ).toEqual([]);
    }
  });

  it("skips dailies, revealed sets, solo connections, and sets nobody or everybody answered", () => {
    const out = pickTurnReminders({
      instances: [
        { id: "daily", connection_id: "c1", kind: "daily", status: "open" },
        { id: "done", connection_id: "c1", kind: "challenge", status: "revealed" },
        { id: "solo", connection_id: "c2", kind: "onboarding", status: "open" },
        { id: "none", connection_id: "c1", kind: "quiz", status: "open" },
        { id: "both", connection_id: "c1", kind: "quiz", status: "open" },
      ],
      membersByConnection: members,
      responses: [
        { instance_id: "daily", user_id: "a", submitted_at: hoursAgo(40) },
        { instance_id: "done", user_id: "a", submitted_at: hoursAgo(40) },
        { instance_id: "solo", user_id: "a", submitted_at: hoursAgo(40) },
        { instance_id: "both", user_id: "a", submitted_at: hoursAgo(40) },
        { instance_id: "both", user_id: "b", submitted_at: hoursAgo(39) },
      ],
      now,
    });
    expect(out).toEqual([]);
  });

  it("ignores responses from people no longer in the connection", () => {
    const out = pickTurnReminders({
      instances: [{ id: "i1", connection_id: "c1", kind: "onboarding", status: "open" }],
      membersByConnection: members,
      responses: [
        { instance_id: "i1", user_id: "a", submitted_at: hoursAgo(40) },
        { instance_id: "i1", user_id: "ghost", submitted_at: hoursAgo(40) },
      ],
      now,
    });
    expect(out.map((r) => r.recipientId)).toEqual(["b"]);
  });
});
