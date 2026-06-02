import Stripe from "stripe";

// Server-only. Lazily constructed so a missing key never breaks the build —
// only the actual billing request fails, with a clear message.
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key);
}
