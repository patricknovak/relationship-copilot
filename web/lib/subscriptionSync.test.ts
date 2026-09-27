import { describe, expect, it } from "vitest";
import { isEntitled, shouldApplySubscriptionEvent } from "./subscriptionSync";

describe("isEntitled", () => {
  it("requires the premium plan and an entitled status", () => {
    expect(isEntitled({ plan: "premium", status: "active" })).toBe(true);
    expect(isEntitled({ plan: "premium", status: "trialing" })).toBe(true);
    expect(isEntitled({ plan: "premium", status: "past_due" })).toBe(false);
    expect(isEntitled({ plan: "premium", status: "canceled" })).toBe(false);
    expect(isEntitled({ plan: "free", status: "active" })).toBe(false);
  });
});

describe("shouldApplySubscriptionEvent", () => {
  const live = { stripe_subscription_id: "sub_new", plan: "premium", status: "active" };

  it("applies when nothing is stored yet", () => {
    expect(shouldApplySubscriptionEvent(null, "sub_x")).toBe(true);
    expect(
      shouldApplySubscriptionEvent(
        { stripe_subscription_id: null, plan: "free", status: "inactive" },
        "sub_x",
      ),
    ).toBe(true);
  });

  it("applies events for the stored subscription itself", () => {
    expect(shouldApplySubscriptionEvent(live, "sub_new")).toBe(true);
  });

  it("skips a stale event for an older subscription while the newer one is entitled", () => {
    expect(shouldApplySubscriptionEvent(live, "sub_old")).toBe(false);
  });

  it("applies a different subscription's event once the stored one lapsed", () => {
    const lapsed = { stripe_subscription_id: "sub_old", plan: "free", status: "canceled" };
    expect(shouldApplySubscriptionEvent(lapsed, "sub_new")).toBe(true);
    const pastDue = { stripe_subscription_id: "sub_old", plan: "premium", status: "past_due" };
    expect(shouldApplySubscriptionEvent(pastDue, "sub_new")).toBe(true);
  });
});
