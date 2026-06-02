"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Start a Stripe Checkout subscription for Premium. The webhook flips the
// `subscriptions` row once payment completes; entitlement is read from there.
export async function createCheckout() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const price = process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM;
  if (!price) throw new Error("Premium price is not configured.");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${site}/account?upgraded=1`,
    cancel_url: `${site}/pricing`,
  });

  if (!session.url) throw new Error("Could not start checkout.");
  redirect(session.url);
}
