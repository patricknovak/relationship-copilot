import { describe, expect, it } from "vitest";
import {
  buildReminderIcs,
  defaultReminderStart,
  escapeIcsText,
  formatIcsLocalDateTime,
  formatIcsUtcDateTime,
} from "./ics";

describe("ics builders", () => {
  it("formats local and UTC timestamps", () => {
    const local = new Date(2026, 9, 3, 19, 0, 0); // Oct 3 2026 7pm local
    expect(formatIcsLocalDateTime(local)).toBe("20261003T190000");

    const utc = new Date(Date.UTC(2026, 9, 2, 14, 30, 5));
    expect(formatIcsUtcDateTime(utc)).toBe("20261002T143005Z");
  });

  it("escapes TEXT per RFC 5545", () => {
    expect(escapeIcsText("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });

  it("defaults to tomorrow 7:00 PM local", () => {
    const now = new Date(2026, 9, 2, 10, 15, 0);
    const start = defaultReminderStart(now);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(3);
    expect(start.getHours()).toBe(19);
    expect(start.getMinutes()).toBe(0);
  });

  it("builds a CRLF VCALENDAR with UID, DTSTAMP, and 15-minute span", () => {
    const start = new Date(2026, 9, 3, 19, 0, 0);
    const stamp = new Date(Date.UTC(2026, 9, 2, 12, 0, 0));
    const connectionUrl = "https://relationshipcopilot.com/connections/abc";
    const ics = buildReminderIcs({
      title: "Relationship Copilot: answer our questions",
      description: `Your answers stay private until you've both shared. ${connectionUrl}`,
      start,
      stamp,
      uid: "test-uid@relationshipcopilot.com",
    });

    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:test-uid@relationshipcopilot.com");
    expect(ics).toContain("DTSTAMP:20261002T120000Z");
    expect(ics).toContain("DTSTART:20261003T190000");
    expect(ics).toContain("DTEND:20261003T191500");
    expect(ics).toContain(
      "SUMMARY:Relationship Copilot: answer our questions",
    );
    expect(ics).toContain(
      "DESCRIPTION:Your answers stay private until you've both shared. https://relationshipcopilot.com/connections/abc",
    );
    expect(ics).not.toMatch(/answer content|Q1:|my answers/i);
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});
