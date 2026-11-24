import { describe, expect, it } from "vitest";
import {
  cancelFailureKind,
  isStripeMissingCustomer,
  isStripeMissingResource,
} from "./stripeErrors";

const noSuchCustomer = {
  type: "StripeInvalidRequestError",
  code: "resource_missing",
  param: "customer",
  message: "No such customer: 'cus_123'",
};
const noSuchPrice = {
  type: "StripeInvalidRequestError",
  code: "resource_missing",
  param: "line_items[0][price]",
  message: "No such price: 'price_123'",
};
const noSuchSubscription = {
  code: "resource_missing",
  param: "id",
  message: "No such subscription: 'sub_123'",
};

describe("isStripeMissingCustomer", () => {
  it("recognises a stored customer Stripe no longer knows", () => {
    expect(isStripeMissingCustomer(noSuchCustomer)).toBe(true);
    // Some endpoints omit param; the message still names the customer.
    expect(isStripeMissingCustomer({ ...noSuchCustomer, param: undefined })).toBe(true);
  });

  it("does not treat a missing price or other failures as a missing customer", () => {
    // Retrying without the customer would not help and would hide a
    // misconfigured price id.
    expect(isStripeMissingCustomer(noSuchPrice)).toBe(false);
    expect(isStripeMissingCustomer(noSuchSubscription)).toBe(false);
    expect(isStripeMissingCustomer({ code: "card_declined", param: "customer" })).toBe(false);
    expect(isStripeMissingCustomer(new Error("fetch failed"))).toBe(false);
    expect(isStripeMissingCustomer(null)).toBe(false);
    expect(isStripeMissingCustomer("resource_missing")).toBe(false);
  });
});

describe("cancelFailureKind", () => {
  it("treats an unknown or already-canceled subscription as nothing left to bill", () => {
    expect(isStripeMissingResource(noSuchSubscription)).toBe(true);
    expect(cancelFailureKind(noSuchSubscription)).toBe("gone");
  });

  it("treats everything else as a subscription that may still be charging", () => {
    expect(cancelFailureKind(new Error("connect ETIMEDOUT"))).toBe("failed");
    expect(cancelFailureKind({ code: "rate_limit" })).toBe("failed");
    expect(cancelFailureKind({ type: "StripeAuthenticationError" })).toBe("failed");
    expect(cancelFailureKind(undefined)).toBe("failed");
  });
});
