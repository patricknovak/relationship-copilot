// Pure decision logic for the Stripe → `subscriptions` sync (the webhook
// route does the I/O). Kept framework-free so the ordering rules are tested.
//
// Stripe does not guarantee delivery order, and a customer can hold more
// than one subscription over time (cancel, later re-subscribe). A late
// `customer.subscription.updated`/`deleted` for the OLD subscription must not
// overwrite the row that the NEW subscription's checkout just wrote — that
// would silently downgrade a paying customer.

export type SubscriptionRow = {
  stripe_subscription_id: string | null;
  status: string;
  plan: string;
};

export const ENTITLED_STATUSES = new Set(["active", "trialing"]);

export function isEntitled(row: Pick<SubscriptionRow, "plan" | "status">): boolean {
  return row.plan === "premium" && ENTITLED_STATUSES.has(row.status);
}

/**
 * Should a subscription event for `incomingSubscriptionId` be applied over
 * the stored row? Apply when there is no row, when it is the same
 * subscription, or when the stored one is no longer entitled. Skip only the
 * stale case: a different subscription's event arriving while the stored
 * (newer) subscription is still entitled.
 */
export function shouldApplySubscriptionEvent(
  existing: SubscriptionRow | null,
  incomingSubscriptionId: string,
): boolean {
  if (!existing || !existing.stripe_subscription_id) return true;
  if (existing.stripe_subscription_id === incomingSubscriptionId) return true;
  return !isEntitled(existing);
}
