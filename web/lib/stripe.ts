import Stripe from "stripe";

// Pin to the version stripe@23's generated types expect (see
// node_modules/stripe/esm/apiVersion.js). Without this, requests silently
// follow whatever the installed SDK defaults to after a major bump.
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;

// Server-only. Lazily constructed so a missing key never breaks the build —
// only the actual billing request fails, with a clear message.
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}
