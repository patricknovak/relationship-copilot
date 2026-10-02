import { describe, expect, it } from "vitest";
import {
  ACQUISITION,
  BOTH_JOINED,
  bothJoinedBody,
  EMPTY_STATE,
  FIRST_REVEAL_UNLOCK,
  MICROCOPY,
  nudgeFinishMessage,
  nudgeStartMessage,
  REMINDER_ICS,
  SAFETY_INTERRUPT,
  SOFT_PREMIUM,
  WAITING_ON_THEM,
  WAITING_ON_YOU,
} from "./firstRevealCopy";

describe("firstRevealCopy", () => {
  it("uses your-person framing, not couples-only", () => {
    expect(EMPTY_STATE.body.toLowerCase()).toContain("your person");
    expect(EMPTY_STATE.secondaryCta.toLowerCase()).toContain("your person");
    expect(ACQUISITION.inviteCta.toLowerCase()).toContain("your person");
    expect(bothJoinedBody(20).toLowerCase()).toContain("your person");
    for (const text of [
      EMPTY_STATE.body,
      bothJoinedBody(12),
      WAITING_ON_THEM.body,
      WAITING_ON_YOU.body,
      FIRST_REVEAL_UNLOCK.body,
      SOFT_PREMIUM.body,
      ACQUISITION.body,
    ]) {
      expect(text.toLowerCase()).not.toMatch(/\b(couples only|partners only)\b/);
    }
  });

  it("builds BOTH_JOINED body with the real question count (10 / 12 / 20)", () => {
    expect(BOTH_JOINED.headline).toBe("You're both here.");
    expect(BOTH_JOINED.primaryCta).toBe("Start answering");
    expect(BOTH_JOINED.secondaryCta).toBe("Nudge them");
    expect(BOTH_JOINED.reminderLink).toBe("Not now? Add a reminder");
    expect(bothJoinedBody(10)).toBe(
      "Your first 10 questions are ready. Answer in private — your person can't see your answers until you've both shared.",
    );
    expect(bothJoinedBody(12)).toBe(
      "Your first 12 questions are ready. Answer in private — your person can't see your answers until you've both shared.",
    );
    expect(bothJoinedBody(20)).toBe(
      "Your first 20 questions are ready. Answer in private — your person can't see your answers until you've both shared.",
    );
  });

  it("falls back when question count is missing or zero", () => {
    const fallback =
      "Your first questions are ready. Answer in private — your person can't see your answers until you've both shared.";
    expect(bothJoinedBody(0)).toBe(fallback);
    expect(bothJoinedBody(-1)).toBe(fallback);
    expect(bothJoinedBody(Number.NaN)).toBe(fallback);
    expect(bothJoinedBody(0)).not.toMatch(/first 0/);
  });

  it("builds nudge start and finish messages without answer content", () => {
    const url = "https://relationshipcopilot.com/connections/abc";
    expect(nudgeStartMessage(url)).toBe(
      "We're both in on Relationship Copilot — want to answer our first questions this week? Neither of us sees the other's answers until we've both shared.\n\nhttps://relationshipcopilot.com/connections/abc",
    );
    expect(nudgeFinishMessage(null, url)).toBe(
      "I've answered on Relationship Copilot — when you're ready, finish yours so we can reveal together. No peeking either way.\n\nhttps://relationshipcopilot.com/connections/abc",
    );
    expect(nudgeFinishMessage("Sam", url)).toContain("Sam has answered");
    expect(REMINDER_ICS.title).toBe("Answer our questions");
    expect(REMINDER_ICS.title).not.toMatch(/Relationship Copilot/i);
    expect(REMINDER_ICS.description(url)).toBe(
      "Your answers stay private until you've both shared. https://relationshipcopilot.com/connections/abc",
    );
  });

  it("keeps Safety and core free; Premium soft after reveal", () => {
    expect(EMPTY_STATE.trustLine.toLowerCase()).toContain("safety");
    expect(EMPTY_STATE.trustLine.toLowerCase()).toContain("free");
    expect(SOFT_PREMIUM.body).toMatch(/Reveals.*stay free/i);
    expect(SOFT_PREMIUM.body).toMatch(/Safety stay free/i);
    expect(SOFT_PREMIUM.body).toMatch(/\$18\/mo/);
    expect(ACQUISITION.trustLine.toLowerCase()).toContain("safety always free");
    expect(SAFETY_INTERRUPT.calm.toLowerCase()).toContain("doesn");
    expect(SAFETY_INTERRUPT.calm.toLowerCase()).toContain("notify");
  });

  it("preserves mutual-reveal enforcement language", () => {
    expect(EMPTY_STATE.body).toMatch(/lives in the product/i);
    expect(ACQUISITION.body).toMatch(/enforced in the product/i);
    expect(WAITING_ON_THEM.body).toMatch(/no peeking/i);
    expect(WAITING_ON_YOU.trustLine).toMatch(/neither of you can see/i);
    expect(MICROCOPY.belowQuestion).toMatch(/private until mutual reveal/i);
    expect(MICROCOPY.confirmOnSubmit).toMatch(/still private/i);
  });

  it("uses Closer, on purpose sparingly on unlock + brand", () => {
    expect(FIRST_REVEAL_UNLOCK.subhead).toBe("Closer, on purpose.");
    expect(ACQUISITION.headline).toBe("Closer, on purpose.");
  });
});
