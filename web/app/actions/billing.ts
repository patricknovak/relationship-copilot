"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";
import { aiEnabled } from "@/lib/grok";
import { isStripeMissingCustomer } from "@/lib/stripeErrors";

// Start a Stripe Checkout subscription for Premium. The webhook flips the
// `subscriptions` row once payment completes; entitlement is read from there.
// `interval` picks the monthly price (default) or the annual one when
// NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL is configured.
export async function createCheckout(formData?: FormData) {
  const interval =
    formData?.get("interval") === "year" &&
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL
      ? "year"
      : "month";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Signed-out visitors keep their upgrade intent through the login round-trip.
  if (!user) redirect("/login?next=/pricing");

  // Premium is mostly the AI layer: never take money for it while the AI
  // provider is switched off here (the pricing page says "opening soon").
  if (!aiEnabled()) redirect("/pricing?error=soon");

  // Already premium? Never start a second concurrent subscription.
  const { data: isPremium } = await supabase.rpc("has_premium", {
    uid: user.id,
  });
  if (isPremium) redirect("/account?upgraded=1");

  const price =
    interval === "year"
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM;
  if (!price) redirect("/pricing?error=checkout");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Re-subscribing customers keep their Stripe customer record (one billing
  // history, one portal login) instead of getting a duplicate per checkout.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const existingCustomer = sub?.stripe_customer_id ?? null;

  let url: string | null = null;
  try {
    const stripe = getStripe();
    const open = (customer: string | null) =>
      stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: price!, quantity: 1 }],
        client_reference_id: user.id,
        ...(customer
          ? { customer }
          : { customer_email: user.email ?? undefined }),
        metadata: { user_id: user.id },
        subscription_data: { metadata: { user_id: user.id } },
        success_url: `${site}/account?upgraded=1`,
        cancel_url: `${site}/pricing`,
      });
    let session;
    try {
      session = await open(existingCustomer);
    } catch (err) {
      // The stored customer is unknown to Stripe (deleted in the Dashboard,
      // or created in test mode). Without this, that person could never
      // check out again. Start a fresh customer; the webhook stores the new
      // id on completion. Any other failure is not retried.
      if (!existingCustomer || !isStripeMissingCustomer(err)) throw err;
      console.error("stripe checkout: stored customer missing, starting a new one");
      session = await open(null);
    }
    url = session.url;
  } catch (err) {
    console.error("stripe checkout session failed", err);
    redirect("/pricing?error=checkout");
  }

  if (!url) redirect("/pricing?error=checkout");
  redirect(url!);
}

// Open the Stripe Customer Portal so a subscriber can update their card,
// see invoices, or cancel (effective at period end — the webhook's
// customer.subscription.updated/deleted events downgrade the row). Terms
// promise "cancel anytime"; this is where that promise is kept.
export async function createBillingPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) redirect("/account?error=nobilling");

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let url: string | null = null;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${site}/account`,
    });
    url = session.url;
  } catch (err) {
    // Most likely cause: the portal has no saved configuration in the Stripe
    // Dashboard for this mode (Settings → Billing → Customer portal).
    console.error("stripe billing portal session failed", err);
    // A customer Stripe no longer knows has no billing to manage; say that
    // instead of "try again in a moment", which would never work.
    redirect(
      isStripeMissingCustomer(err)
        ? "/account?error=nobilling"
        : "/account?error=portal",
    );
  }

  await logAudit(user.id, "billing.portal");
  if (!url) redirect("/account?error=portal");
  redirect(url!);
}
