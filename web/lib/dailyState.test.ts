import { describe, expect, it } from "vitest";
import { dailyBadge, dailyCardCopy, dailyState, isValidTimeZone, todayIn, todayUtc } from "./dailyState";

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
