import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe → subscriptions sync. The service-role client bypasses RLS (the user
// can't write their own entitlement). Signature is verified before any write.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: Stripe retries deliveries. Claim the event id first; if it
  // was already processed, acknowledge without re-applying.
  const { error: claimErr } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (claimErr?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : null);

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.metadata?.user_id ?? s.client_reference_id ?? null;
      if (userId) {
        await admin.from("subscriptions").upsert({
          user_id: userId,
          plan: "premium",
          status: "active",
          stripe_customer_id: str(s.customer),
          stripe_subscription_id: str(s.subscription),
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id ?? null;
      const active = sub.status === "active" || sub.status === "trialing";
      if (userId) {
        await admin.from("subscriptions").upsert({
          user_id: userId,
          plan: active ? "premium" : "free",
          status: sub.status,
          stripe_subscription_id: sub.id,
          stripe_customer_id: str(sub.customer),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
