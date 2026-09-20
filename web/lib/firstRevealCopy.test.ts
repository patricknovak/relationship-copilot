import { describe, expect, it } from "vitest";
import {
  ACQUISITION,
  EMPTY_STATE,
  FIRST_REVEAL_UNLOCK,
  MICROCOPY,
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
    for (const text of [
      EMPTY_STATE.body,
      WAITING_ON_THEM.body,
      WAITING_ON_YOU.body,
      FIRST_REVEAL_UNLOCK.body,
      SOFT_PREMIUM.body,
      ACQUISITION.body,
    ]) {
      expect(text.toLowerCase()).not.toMatch(/\b(couples only|partners only)\b/);
    }
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
