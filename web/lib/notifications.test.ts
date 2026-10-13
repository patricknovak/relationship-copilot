import { describe, expect, it } from "vitest";
import {
  ALL_OFF,
  buildNotificationEmail,
  DEFAULT_PREFS,
  parseNotificationPrefs,
  PREF_FOR_KIND,
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
  withNotificationPrefs,
} from "./notifications";

describe("parseNotificationPrefs", () => {
  it("defaults when the blob is empty or malformed", () => {
    expect(parseNotificationPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parseNotificationPrefs({})).toEqual(DEFAULT_PREFS);
    expect(parseNotificationPrefs("junk")).toEqual(DEFAULT_PREFS);
    expect(parseNotificationPrefs({ notifications: "no" })).toEqual(DEFAULT_PREFS);
  });

  it("reads explicit booleans and ignores other types", () => {
    expect(
      parseNotificationPrefs({
        notifications: { your_turn: false, daily_ready: true, revealed: "yes" },
      }),
    ).toEqual({ your_turn: false, revealed: true, daily_ready: true });
  });
});

describe("withNotificationPrefs", () => {
  it("merges without clobbering unrelated keys", () => {
    const out = withNotificationPrefs(
      { theme: "dark", notifications: { daily_ready: true } },
      { your_turn: false },
    );
    expect(out.theme).toBe("dark");
    expect(out.notifications).toEqual({
      your_turn: false,
      revealed: true,
      daily_ready: true,
    });
  });

  it("can switch everything off", () => {
    expect(withNotificationPrefs(null, ALL_OFF).notifications).toEqual(ALL_OFF);
  });
});

describe("buildNotificationEmail", () => {
  const base = {
    instanceUrl: "https://relationshipcopilot.com/connections/c/prompts/i",
    unsubscribeUrl: "https://relationshipcopilot.com/api/notifications/unsubscribe?u=x&t=y",
  };

  it("names the other person by first name only", () => {
    const e = buildNotificationEmail({ ...base, kind: "your_turn", themName: "Sam Rivera" });
    expect(e.subject).toBe("Sam answered — your turn");
    expect(e.text).toContain("Sam has answered");
    expect(e.text).not.toContain("Rivera");
  });

  it("falls back to 'your person'", () => {
    const e = buildNotificationEmail({ ...base, kind: "revealed", themName: "  " });
    expect(e.subject).toBe("You and Your person both answered");
  });

  it("includes the question text only for daily_ready and escapes HTML", () => {
    const e = buildNotificationEmail({
      ...base,
      kind: "daily_ready",
      themName: "Sam",
      questionText: "What's <one> thing?",
    });
    expect(e.text).toContain("What's <one> thing?");
    expect(e.html).toContain("What&#39;s &lt;one&gt; thing?");
    const noQ = buildNotificationEmail({
      ...base,
      kind: "your_turn",
      themName: "Sam",
      questionText: "should be ignored",
    });
    expect(noQ.text).not.toContain("should be ignored");
  });

  it("announces a joined partner", () => {
    const e = buildNotificationEmail({ ...base, kind: "partner_joined", themName: "Sam" });
    expect(e.subject).toBe("Sam joined — your first questions are ready");
    expect(PREF_FOR_KIND.partner_joined).toBe("your_turn");
  });

  it("always links the action and the unsubscribe", () => {
    for (const kind of ["your_turn", "revealed", "daily_ready", "partner_joined"] as const) {
      const e = buildNotificationEmail({ ...base, kind, themName: null });
      expect(e.text).toContain(base.instanceUrl);
      expect(e.text).toContain(base.unsubscribeUrl);
      expect(e.html).toContain(base.instanceUrl);
      expect(e.html).toContain("Stop these emails");
    }
  });
});

describe("unsubscribe token", () => {
  const secret = "s3cret";
  it("round-trips and rejects tampering", () => {
    const t = unsubscribeToken("user-1", secret);
    expect(verifyUnsubscribeToken("user-1", t, secret)).toBe(true);
    expect(verifyUnsubscribeToken("user-2", t, secret)).toBe(false);
    expect(verifyUnsubscribeToken("user-1", t.slice(1) + "0", secret)).toBe(false);
    expect(verifyUnsubscribeToken("user-1", t, "other")).toBe(false);
    expect(verifyUnsubscribeToken("user-1", "", secret)).toBe(false);
  });

  it("builds a same-origin URL with both params", () => {
    const u = new URL(unsubscribeUrl("https://relationshipcopilot.com", "user-1", secret));
    expect(u.pathname).toBe("/api/notifications/unsubscribe");
    expect(u.searchParams.get("u")).toBe("user-1");
    expect(u.searchParams.get("t")).toBe(unsubscribeToken("user-1", secret));
  });
});
