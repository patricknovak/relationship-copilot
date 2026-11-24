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

/**
 * Unix seconds for the subscription's current period end, or null if Stripe
 * did not send one. Prefer item-level `current_period_end` (stripe@23+ types /
 * API); fall back to the legacy top-level field when present at runtime.
 * Never invents a date.
 */
export function resolveSubscriptionPeriodEnd(sub: {
  current_period_end?: unknown;
  items?: { data?: ReadonlyArray<unknown> };
}): number | null {
  const first = sub.items?.data?.[0];
  const fromItem =
    first && typeof first === "object" && "current_period_end" in first
      ? (first as { current_period_end: unknown }).current_period_end
      : undefined;
  if (typeof fromItem === "number") return fromItem;
  return typeof sub.current_period_end === "number" ? sub.current_period_end : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A Stripe metadata value that is one of our user ids, else null. */
export function metadataUserId(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const v = metadata?.user_id;
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
}

/**
 * Whose Premium a completed Checkout Session unlocks, or null when it must
 * not unlock anything.
 *
 * Only sessions our own createCheckout action made count: subscription mode,
 * a subscription attached, paid, and `metadata.user_id` set. Metadata can
 * only be written with the Stripe secret key. `client_reference_id` is NOT
 * trusted: on a Payment Link or pricing table the buyer sets it in the URL,
 * so any other product ever sold from the same Stripe account could be
 * bought with someone's user id attached and would have granted Premium
 * here (with no subscription to ever end it).
 */
export function checkoutEntitlementUserId(session: {
  mode?: unknown;
  payment_status?: unknown;
  subscription?: unknown;
  metadata?: Record<string, unknown> | null;
}): string | null {
  if (session.mode !== "subscription") return null;
  if (typeof session.subscription !== "string" || !session.subscription) return null;
  // Delayed payment methods complete checkout before the money arrives
  // ("unpaid"); entitlement then comes from customer.subscription.updated.
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return null;
  }
  return metadataUserId(session.metadata);
}
