import { expect, test } from "@playwright/test";
import {
  admin,
  declineAnalytics,
  deliverStripeEvent,
  makeUser,
  signedInPage,
  stripeCalls,
} from "./helpers";

// Runs in the "billing" Playwright project: the same build on a second port
// with the AI provider switched on, because checkout stays closed while AI
// is off. Stripe is e2e-core/fake-providers.mjs on loopback; webhook events
// are signed here with the suite's fake endpoint secret, the way Stripe
// signs them.

const subscriptionRow = async (userId: string) =>
  (
    await admin
      .from("subscriptions")
      .select("plan, status, stripe_customer_id, stripe_subscription_id, current_period_end")
      .eq("user_id", userId)
      .maybeSingle()
  ).data;

test("upgrade, webhook unlock, manage billing, cancel, and upgrading again", async ({
  browser,
  request,
}) => {
  const pat = await makeUser("pat-billing", "Pat");
  const customer = `cus_e2e_${Date.now()}`;
  const subscription = `sub_e2e_${Date.now()}`;
  const p = await signedInPage(browser, pat.email, "/pricing");
  await declineAnalytics(p);

  // Upgrade opens a Checkout session for this person and sends them to it.
  await p.getByRole("button", { name: "Upgrade to Premium" }).click();
  await p.waitForURL(/\/pay\/cs_test_/);
  await expect(p.getByRole("heading", { name: "Fake Stripe Checkout" })).toBeVisible();
  const sessionId = p.url().split("/pay/")[1]!;
  const [checkout] = await stripeCalls((c) => c.id === sessionId);
  expect(checkout).toBeTruthy();
  expect(checkout!.path).toBe("/v1/checkout/sessions");
  expect(checkout!.params.mode).toBe("subscription");
  expect(checkout!.params["line_items[0][price]"]).toBe(
    process.env.CI ? "price_e2e_monthly" : expect.stringMatching(/^price_/),
  );
  expect(checkout!.params["line_items[0][quantity]"]).toBe("1");
  expect(checkout!.params.customer_email).toBe(pat.email);
  expect(checkout!.params.customer).toBeUndefined();
  expect(checkout!.params["metadata[user_id]"]).toBe(pat.id);
  expect(checkout!.params["subscription_data[metadata][user_id]"]).toBe(pat.id);
  expect(checkout!.params.success_url).toMatch(/\/account\?upgraded=1$/);
  expect(checkout!.params.cancel_url).toMatch(/\/pricing$/);

  // Nothing is unlocked by starting checkout.
  expect(await subscriptionRow(pat.id)).toBeNull();

  // A forged delivery is refused and changes nothing.
  const session = {
    id: sessionId,
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    customer,
    subscription,
    metadata: { user_id: pat.id },
  };
  const forged = await deliverStripeEvent(request, "checkout.session.completed", session, {
    signature: `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`,
  });
  expect(forged.response.status()).toBe(400);
  expect(await subscriptionRow(pat.id)).toBeNull();

  // Stripe's signed "checkout completed" unlocks Premium.
  const completed = await deliverStripeEvent(request, "checkout.session.completed", session);
  expect(completed.response.status()).toBe(200);
  expect(await completed.response.json()).toEqual({ received: true });
  expect(await subscriptionRow(pat.id)).toMatchObject({
    plan: "premium",
    status: "active",
    stripe_customer_id: customer,
    stripe_subscription_id: subscription,
  });
  // A redelivery of the same event is acknowledged, not applied again.
  const again = await deliverStripeEvent(request, "checkout.session.completed", session, {
    id: completed.id,
  });
  expect(await again.response.json()).toEqual({ received: true, duplicate: true });

  await p.goto("/account?upgraded=1");
  await expect(p.getByText(/Welcome to Premium/)).toBeVisible();
  await p.goto("/pricing");
  await expect(p.getByText("You're on Premium")).toBeVisible();
  await expect(p.getByRole("button", { name: "Upgrade to Premium" })).toHaveCount(0);

  // The renewal event carries the period end; the account page shows it.
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400;
  const live = {
    id: subscription,
    object: "subscription",
    status: "active",
    customer,
    metadata: { user_id: pat.id },
    items: { data: [{ current_period_end: periodEnd }] },
  };
  expect(
    (await deliverStripeEvent(request, "customer.subscription.updated", live)).response.status(),
  ).toBe(200);
  await p.goto("/account");
  await expect(p.getByText(/Your current billing period ends/)).toBeVisible();

  // Manage billing opens the Customer Portal for this customer.
  await p.getByRole("button", { name: "Manage billing" }).click();
  await p.waitForURL(/\/portal\/bps_test_/);
  await expect(p.getByRole("heading", { name: "Fake Stripe Billing Portal" })).toBeVisible();
  const portalId = p.url().split("/portal/")[1]!;
  const [portal] = await stripeCalls((c) => c.id === portalId);
  expect(portal!.path).toBe("/v1/billing_portal/sessions");
  expect(portal!.params.customer).toBe(customer);
  expect(portal!.params.return_url).toMatch(/\/account$/);

  // The subscription ends (cancelled in the portal, period over): back to Free.
  expect(
    (
      await deliverStripeEvent(request, "customer.subscription.deleted", {
        ...live,
        status: "canceled",
      })
    ).response.status(),
  ).toBe(200);
  expect(await subscriptionRow(pat.id)).toMatchObject({ plan: "free", status: "canceled" });
  await p.goto("/account");
  await expect(p.getByText("The core experience is free.")).toBeVisible();
  // Billing history is still reachable after downgrading.
  await expect(p.getByRole("button", { name: "Manage billing" })).toBeVisible();

  // Upgrading again reuses the same Stripe customer instead of a duplicate.
  await p.goto("/pricing");
  await p.getByRole("button", { name: "Upgrade to Premium" }).click();
  await p.waitForURL(/\/pay\/cs_test_/);
  const secondId = p.url().split("/pay/")[1]!;
  const [second] = await stripeCalls((c) => c.id === secondId);
  expect(second!.params.customer).toBe(customer);
  expect(second!.params.customer_email).toBeUndefined();
});

test("a paid session that only carries a buyer-set reference unlocks nothing", async ({
  request,
}) => {
  const pat = await makeUser("pat-reference", "Pat");
  // What a Payment Link sale looks like: client_reference_id is set from the
  // URL by the buyer; our own checkout always writes metadata.user_id.
  const delivered = await deliverStripeEvent(request, "checkout.session.completed", {
    id: `cs_test_reference_${Date.now()}`,
    object: "checkout.session",
    mode: "subscription",
    payment_status: "paid",
    customer: "cus_e2e_other",
    subscription: "sub_e2e_other",
    client_reference_id: pat.id,
    metadata: {},
  });
  expect(delivered.response.status()).toBe(200);
  expect(await subscriptionRow(pat.id)).toBeNull();
  const { data: premium } = await admin.rpc("has_premium", { uid: pat.id });
  expect(premium).toBeFalsy();
});

test("a signed-out visitor is sent to sign in and comes back to pricing", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/pricing");
  await declineAnalytics(page);
  await page.getByRole("button", { name: "Upgrade to Premium" }).click();
  await page.waitForURL(/\/login\?next=(%2F|\/)pricing/);
});
