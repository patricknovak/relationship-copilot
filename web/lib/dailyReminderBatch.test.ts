import { describe, expect, it } from "vitest";
import { localHour } from "./dailyReminderBatch";

describe("localHour", () => {
  it("reads the hour in the connection's zone and falls back to UTC", () => {
    const now = new Date("2026-10-17T15:30:00Z");
    expect(localHour("America/Vancouver", now)).toBe(8);
    expect(localHour("Europe/Paris", now)).toBe(17);
    expect(localHour("Not/AZone", now)).toBe(15);
  });
});
