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
  // Signed-out visitors keep their upgrade intent through the login round-trip.
  if (!user) redirect("/login?next=/pricing");

  // Already premium? Never start a second concurrent subscription.
  const { data: isPremium } = await supabase.rpc("has_premium", {
    uid: user.id,
  });
  if (isPremium) redirect("/account?upgraded=1");

  const price = process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM;
  if (!price) redirect("/pricing?error=checkout");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let url: string | null = null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price!, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${site}/account?upgraded=1`,
      cancel_url: `${site}/pricing`,
    });
    url = session.url;
  } catch {
    redirect("/pricing?error=checkout");
  }

  if (!url) redirect("/pricing?error=checkout");
  redirect(url!);
}
