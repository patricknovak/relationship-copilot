// Pure classification of Stripe API errors, so billing actions can tell
// "that object no longer exists" (safe to route around) from "Stripe did not
// do what we asked" (must not be swallowed). Framework-free and tested; takes
// `unknown` so it never depends on the SDK's error classes.

type StripeLikeError = { code?: unknown; param?: unknown; message?: unknown };

function asStripeError(err: unknown): StripeLikeError | null {
  return err && typeof err === "object" ? (err as StripeLikeError) : null;
}

/** Stripe's "No such <object>" error (deleted, or from the other mode). */
export function isStripeMissingResource(err: unknown): boolean {
  return asStripeError(err)?.code === "resource_missing";
}

/**
 * The stored customer id is unknown to Stripe: deleted in the Dashboard, or
 * created in test mode and looked up with a live key. Checkout can start
 * over with a fresh customer; a missing price or anything else cannot.
 */
export function isStripeMissingCustomer(err: unknown): boolean {
  const e = asStripeError(err);
  if (!e || e.code !== "resource_missing") return false;
  if (e.param === "customer") return true;
  return typeof e.message === "string" && /no such customer/i.test(e.message);
}

/**
 * After asking Stripe to cancel a subscription during account deletion:
 * "gone" means there is nothing left to bill (already canceled or unknown),
 * "failed" means the subscription may still be charging.
 */
export function cancelFailureKind(err: unknown): "gone" | "failed" {
  return isStripeMissingResource(err) ? "gone" : "failed";
}
