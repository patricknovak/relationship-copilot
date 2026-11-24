import { describe, expect, it } from "vitest";
import {
  checkoutEntitlementUserId,
  isEntitled,
  metadataUserId,
  resolveSubscriptionPeriodEnd,
  shouldApplySubscriptionEvent,
} from "./subscriptionSync";

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

describe("resolveSubscriptionPeriodEnd", () => {
  it("prefers the first subscription item's current_period_end", () => {
    expect(
      resolveSubscriptionPeriodEnd({
        current_period_end: 100,
        items: { data: [{ current_period_end: 200 }] },
      }),
    ).toBe(200);
  });

  it("falls back to the legacy top-level field", () => {
    expect(resolveSubscriptionPeriodEnd({ current_period_end: 100 })).toBe(100);
    expect(resolveSubscriptionPeriodEnd({ items: { data: [] } })).toBe(null);
    expect(resolveSubscriptionPeriodEnd({})).toBe(null);
  });
});

describe("checkoutEntitlementUserId", () => {
  const uid = "3f2b8a1e-6c1d-4e0a-9b7f-2d5c8e4a1b90";
  const ours = {
    mode: "subscription",
    payment_status: "paid",
    subscription: "sub_123",
    metadata: { user_id: uid },
  };

  it("accepts a paid subscription session carrying our metadata", () => {
    expect(checkoutEntitlementUserId(ours)).toBe(uid);
    expect(
      checkoutEntitlementUserId({ ...ours, payment_status: "no_payment_required" }),
    ).toBe(uid);
  });

  it("never trusts client_reference_id (buyer-controlled on Payment Links)", () => {
    const session = { ...ours, metadata: {}, client_reference_id: uid };
    expect(checkoutEntitlementUserId(session)).toBeNull();
    expect(checkoutEntitlementUserId({ ...session, metadata: null })).toBeNull();
  });

  it("ignores one-off payments and sessions without a subscription", () => {
    expect(checkoutEntitlementUserId({ ...ours, mode: "payment" })).toBeNull();
    expect(checkoutEntitlementUserId({ ...ours, mode: "setup" })).toBeNull();
    expect(checkoutEntitlementUserId({ ...ours, subscription: null })).toBeNull();
  });

  it("waits for payment on delayed methods", () => {
    expect(checkoutEntitlementUserId({ ...ours, payment_status: "unpaid" })).toBeNull();
  });

  it("rejects metadata that is not a user id", () => {
    expect(metadataUserId({ user_id: "not-a-uuid" })).toBeNull();
    expect(metadataUserId({ user_id: 42 })).toBeNull();
    expect(metadataUserId(null)).toBeNull();
    expect(checkoutEntitlementUserId({ ...ours, metadata: { user_id: "x" } })).toBeNull();
  });
});
