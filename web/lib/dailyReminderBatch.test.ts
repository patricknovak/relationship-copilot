import { describe, expect, it } from "vitest";
import {
  localHour,
  answeredByInstance,
  displayNameMap,
  filterConnectionsInSendWindow,
  membersByConnection,
  partitionDailyInstances,
} from "./dailyReminderBatch";

describe("filterConnectionsInSendWindow", () => {
  it("keeps only connections whose local hour is inside the window", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const hour = (tz: string) => (tz === "in" ? 10 : 3);
    const kept = filterConnectionsInSendWindow(
      [
        { id: "a", timezone: "in" },
        { id: "b", timezone: "out" },
      ],
      hour,
      now,
      9,
      20,
    );
    expect(kept.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("membersByConnection", () => {
  it("groups user ids by connection", () => {
    const map = membersByConnection([
      { connection_id: "c1", user_id: "u1" },
      { connection_id: "c1", user_id: "u2" },
      { connection_id: "c2", user_id: "u3" },
    ]);
    expect(map.get("c1")).toEqual(["u1", "u2"]);
    expect(map.get("c2")).toEqual(["u3"]);
  });
});

describe("answeredByInstance", () => {
  it("builds per-instance answered sets", () => {
    const map = answeredByInstance([
      { instance_id: "i1", user_id: "u1" },
      { instance_id: "i1", user_id: "u2" },
      { instance_id: "i2", user_id: "u1" },
    ]);
    expect(map.get("i1")).toEqual(new Set(["u1", "u2"]));
    expect(map.get("i2")).toEqual(new Set(["u1"]));
  });
});

describe("displayNameMap", () => {
  it("trims names and nulls blanks", () => {
    const map = displayNameMap([
      { id: "u1", display_name: "  Ada  " },
      { id: "u2", display_name: "   " },
      { id: "u3", display_name: null },
    ]);
    expect(map.get("u1")).toBe("Ada");
    expect(map.get("u2")).toBeNull();
    expect(map.get("u3")).toBeNull();
  });
});

describe("partitionDailyInstances", () => {
  it("splits ready vs missing by each connection's local today", () => {
    const todayFor = new Map([
      ["c1", "2026-06-01"],
      ["c2", "2026-06-02"],
      ["c3", "2026-06-01"],
    ]);
    const { ready, missing } = partitionDailyInstances(
      ["c1", "c2", "c3"],
      todayFor,
      [
        { id: "i1", connection_id: "c1", scheduled_for: "2026-06-01" },
        { id: "i2", connection_id: "c2", scheduled_for: "2026-06-01" }, // wrong day
      ],
    );
    expect(ready.get("c1")).toBe("i1");
    expect(missing).toEqual(["c2", "c3"]);
  });
});

describe("localHour", () => {
  it("reads the hour in the connection's zone and falls back to UTC", () => {
    const now = new Date("2026-10-17T15:30:00Z");
    expect(localHour("America/Vancouver", now)).toBe(8);
    expect(localHour("Europe/Paris", now)).toBe(17);
    expect(localHour("Not/AZone", now)).toBe(15);
  });
});
