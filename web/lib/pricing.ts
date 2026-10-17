// The one place the Premium list price lives. Every display string and the
// JSON-LD offer derive from it. The amount actually charged is the Stripe
// price (NEXT_PUBLIC_STRIPE_PRICE_PREMIUM), so change the two together.
// lib/pricing.test.ts fails if a price is hard-coded anywhere else.

/** Monthly list price in USD, as schema.org wants it ("18.00"). */
export const PREMIUM_MONTHLY_USD = "18.00";

/** "$18/mo", or "$9.99/mo" for a price with cents. */
export function monthlyDisplay(usd: string): string {
  const n = Number(usd);
  const amount = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `$${amount}/mo`;
}

export const PREMIUM_MONTHLY_DISPLAY = monthlyDisplay(PREMIUM_MONTHLY_USD);
