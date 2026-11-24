import { describe, expect, it } from "vitest";
import {
  catchUpCopy,
  catchUpDailies,
  dailyHeading,
  formatDay,
  shiftDate,
  dailyBadge,
  dailyCardCopy,
  dailyState,
  firstSetBadge,
  isValidTimeZone,
  todayIn,
  todayUtc,
} from "./dailyState";

describe("dailyState", () => {
  it("is none without an instance", () => {
    expect(
      dailyState({ hasInstance: false, iAnswered: false, theyAnswered: false }),
    ).toBe("none");
  });

  it("maps the four open/revealed states", () => {
    const base = { hasInstance: true, status: "open" };
    expect(dailyState({ ...base, iAnswered: false, theyAnswered: false })).toBe(
      "answer",
    );
    expect(dailyState({ ...base, iAnswered: true, theyAnswered: false })).toBe(
      "waiting",
    );
    expect(dailyState({ ...base, iAnswered: false, theyAnswered: true })).toBe(
      "your_turn",
    );
    expect(
      dailyState({
        hasInstance: true,
        status: "revealed",
        iAnswered: true,
        theyAnswered: true,
      }),
    ).toBe("revealed");
  });

  it("treats both-answered-but-open as revealed (trigger race)", () => {
    expect(
      dailyState({
        hasInstance: true,
        status: "open",
        iAnswered: true,
        theyAnswered: true,
      }),
    ).toBe("revealed");
  });
});

describe("dailyBadge", () => {
  it("surfaces action states and hides none", () => {
    expect(dailyBadge("your_turn")).toEqual({ label: "Your turn", tone: "action" });
    expect(dailyBadge("answer")?.tone).toBe("action");
    expect(dailyBadge("waiting")?.tone).toBe("quiet");
    expect(dailyBadge("revealed")?.tone).toBe("done");
    expect(dailyBadge("none")).toBeNull();
  });
});

describe("dailyCardCopy", () => {
  it("uses the other person's name when known", () => {
    expect(dailyCardCopy("your_turn", "Sam").body).toBe(
      "Sam answered today's question. Finish yours to reveal both.",
    );
    expect(dailyCardCopy("waiting", "Sam").body).toBe(
      "Your answer stays private until Sam shares too.",
    );
  });

  it("falls back to they/them without a name", () => {
    expect(dailyCardCopy("your_turn", null).body).toMatch(/^They answered/);
    expect(dailyCardCopy("waiting", "  ").body).toBe(
      "Your answer stays private until they share too.",
    );
  });

  it("never contains answer text placeholders", () => {
    for (const s of ["none", "answer", "waiting", "your_turn", "revealed"] as const) {
      const c = dailyCardCopy(s, "Sam");
      expect(c.headline.length).toBeGreaterThan(0);
      expect(c.cta.length).toBeGreaterThan(0);
    }
  });
});

describe("todayUtc", () => {
  it("formats the UTC calendar date", () => {
    expect(todayUtc(new Date("2026-10-13T23:30:00-07:00"))).toBe("2026-10-14");
    expect(todayUtc(new Date("2026-10-13T12:00:00Z"))).toBe("2026-10-13");
  });
});

describe("todayIn", () => {
  it("follows the connection's zone", () => {
    const at = new Date("2026-10-14T01:30:00Z"); // 18:30 the 13th in Vancouver
    expect(todayIn("America/Vancouver", at)).toBe("2026-10-13");
    expect(todayIn("UTC", at)).toBe("2026-10-14");
    expect(todayIn("Pacific/Kiritimati", at)).toBe("2026-10-14");
  });

  it("falls back to UTC for unknown or missing zones", () => {
    const at = new Date("2026-10-14T01:30:00Z");
    expect(todayIn(null, at)).toBe("2026-10-14");
    expect(todayIn("Not/AZone", at)).toBe("2026-10-14");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects junk", () => {
    expect(isValidTimeZone("America/Vancouver")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});

describe("firstSetBadge", () => {
  it("tells the invitee it's their turn on the first set", () => {
    expect(firstSetBadge("your_turn", true)).toEqual({ label: "Your turn", tone: "action" });
  });
  it("tells an inviter who answered first that the invite is pending", () => {
    expect(firstSetBadge("waiting", false)?.label).toBe("Answered · invite pending");
    expect(firstSetBadge("waiting", true)?.label).toBe("Waiting on them");
  });
  it("nudges both to start once both are in, and stays quiet before that", () => {
    expect(firstSetBadge("answer", true)).toEqual({ label: "First questions", tone: "action" });
    expect(firstSetBadge("none", true)?.label).toBe("First questions");
    expect(firstSetBadge("answer", false)).toBeNull();
    expect(firstSetBadge("revealed", true)).toBeNull();
  });
});

describe("catchUpDailies", () => {
  const today = "2026-11-24";
  const inst = (id: string, scheduled_for: string | null, status = "open") => ({
    id,
    scheduled_for,
    status,
  });

  it("lists earlier open days they answered and I have not, newest first", () => {
    // The production case this was written for: one person answered three
    // days running while the other was away, and the hub only ever showed
    // the returning person today's fresh question.
    const out = catchUpDailies({
      instances: [
        inst("d19", "2026-11-19"),
        inst("d20", "2026-11-20"),
        inst("d21", "2026-11-21"),
        inst("d22", "2026-11-22"), // nobody answered
        inst("d24", today), // today's card handles this one
      ],
      today,
      answeredByMe: new Set(),
      answeredByThem: new Set(["d19", "d20", "d21", "d24"]),
    });
    expect(out.map((i) => i.id)).toEqual(["d21", "d20", "d19"]);
  });

  it("leaves out days I already answered, revealed days, and undated sets", () => {
    const out = catchUpDailies({
      instances: [
        inst("mine", "2026-11-20"),
        inst("revealed", "2026-11-21", "revealed"),
        inst("undated", null),
      ],
      today,
      answeredByMe: new Set(["mine"]),
      answeredByThem: new Set(["mine", "revealed", "undated"]),
    });
    expect(out).toEqual([]);
  });

  it("never lists today or a future date (connection zone ahead of UTC)", () => {
    const out = catchUpDailies({
      instances: [inst("today", today), inst("tomorrow", "2026-11-25")],
      today,
      answeredByMe: new Set(),
      answeredByThem: new Set(["today", "tomorrow"]),
    });
    expect(out).toEqual([]);
  });

  it("caps the list", () => {
    const instances = Array.from({ length: 9 }, (_, i) =>
      inst(`d${i}`, shiftDate(today, -(i + 1))),
    );
    const all = new Set(instances.map((i) => i.id));
    expect(
      catchUpDailies({ instances, today, answeredByMe: new Set(), answeredByThem: all }),
    ).toHaveLength(5);
    expect(
      catchUpDailies({
        instances,
        today,
        answeredByMe: new Set(),
        answeredByThem: all,
        limit: 2,
      }).map((i) => i.id),
    ).toEqual(["d0", "d1"]);
  });
});

describe("shiftDate / formatDay / dailyHeading", () => {
  it("shifts calendar dates across month and year ends", () => {
    expect(shiftDate("2026-11-24", -30)).toBe("2026-10-25");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("formats a calendar date without drifting a day", () => {
    expect(formatDay("2026-11-19")).toBe("November 19");
    expect(formatDay("2026-01-01")).toBe("January 1");
    expect(formatDay("not-a-date")).toBe("not-a-date");
  });

  it("calls only the current local day today's question", () => {
    expect(dailyHeading("2026-11-24", "2026-11-24")).toBe("Today's question");
    expect(dailyHeading("2026-11-19", "2026-11-24")).toBe("Question from November 19");
    expect(dailyHeading(null, "2026-11-24")).toBe("Today's question");
  });
});

describe("catchUpCopy", () => {
  it("names the other person and counts", () => {
    expect(catchUpCopy(1, "Sam").headline).toBe("Sam is waiting on your answer.");
    expect(catchUpCopy(3, "Sam").headline).toBe("Sam is waiting on 3 of your answers.");
    expect(catchUpCopy(3, "Sam").body).toContain("What Sam wrote stays private");
  });

  it("falls back to they", () => {
    expect(catchUpCopy(1, null).headline).toBe("They are waiting on your answer.");
    expect(catchUpCopy(2, "  ").headline).toBe("They are waiting on 2 of your answers.");
    expect(catchUpCopy(2, "  ").body).toContain("What they wrote");
  });
});
