import { createHmac, randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Runs only against a local Supabase stack (scripts/e2e-core-stack.sh), never
// production: the service-role key here is the CLI's public demo key.
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(SUPABASE_URL)) {
  throw new Error("e2e-core only runs against a local Supabase stack");
}

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function makeUser(prefix: string, displayName: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  await admin.from("profiles").update({ display_name: displayName }).eq("id", data.user.id);
  return { id: data.user.id, email };
}

/** Sign a user in through the app's own /auth/confirm (token_hash) route. */
export async function signedInPage(browser: Browser, email: string, next: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`,
  );
  await page.waitForLoadState("networkidle");
  return page;
}

/** Fill every question on the visible answer form (text, scale, choice). */
export async function answerAll(page: Page, text: string) {
  await page.waitForLoadState("networkidle");
  for (const ta of await page.locator("textarea").all()) await ta.fill(text);
  for (const group of await page.locator('[role="radiogroup"]').all()) {
    await group.locator("label").first().click();
  }
  await page.getByRole("button", { name: /share when ready/i }).click();
}

/**
 * Make today's question for a connection a free-text one. ensure_daily_prompt
 * picks a template at random, and about one in seven daily templates is a
 * choice or scale question with nowhere to type, so a test that looks for its
 * own typed answer after the reveal failed on those draws (PRs #180 and #184,
 * 2026-11-24). Call after both people have joined and before either answers.
 */
export async function pinDailyToFreeText(connectionId: string) {
  const { data: instanceId, error } = await admin.rpc("ensure_daily_prompt", {
    p_conn: connectionId,
  });
  if (error || !instanceId) throw error ?? new Error("no daily prompt for this connection");
  const { error: updateError } = await admin
    .from("prompt_instances")
    .update({
      questions: [
        { id: "q1", text: "What made you smile today?", format: "free_text" },
      ],
    })
    .eq("id", instanceId);
  if (updateError) throw updateError;
}

// ---------------------------------------------------------------------------
// Two people in one connection
// ---------------------------------------------------------------------------

/** Create a connection of the given type from /connections/new; returns its id. */
export async function startConnection(page: Page, type: RegExp): Promise<string> {
  await page.getByText(type).first().click();
  await page.getByRole("button", { name: /create|start|continue|next/i }).first().click();
  await page.waitForURL(/\/connections\/[0-9a-f-]{36}(?:#invite)?$/);
  return page.url().split("/").pop()!.split("#")[0]!;
}

export async function inviteCodeFor(connectionId: string): Promise<string> {
  const { data, error } = await admin
    .from("connections")
    .select("invite_code")
    .eq("id", connectionId)
    .single();
  if (error || !data?.invite_code) throw error ?? new Error("connection has no invite code");
  return data.invite_code as string;
}

/**
 * Sam creates a connection and answers the first set (so it exists before
 * anyone joins), then Alex accepts the invite. Both stay signed in.
 */
export async function connectedPair(
  browser: Browser,
  opts: { firstSetAnswer: string; type?: RegExp } = { firstSetAnswer: "Sam first set" },
) {
  const sam = await makeUser("sam", "Sam");
  const alex = await makeUser("alex", "Alex");
  const s = await signedInPage(browser, sam.email, "/connections/new");
  const connectionId = await startConnection(s, opts.type ?? /friend/i);
  await s.getByRole("button", { name: "Answer yours now" }).click();
  await s.waitForURL(new RegExp(`/connections/${connectionId}/onboarding`));
  await s.goto(`/connections/${connectionId}/onboarding`);
  await answerAll(s, opts.firstSetAnswer);
  await expectAnswerCount(sam.id, 1);

  const a = await signedInPage(browser, alex.email, `/invite/${await inviteCodeFor(connectionId)}`);
  await a.waitForURL(new RegExp(`/connections/${connectionId}`));
  return { sam, alex, s, a, connectionId };
}

/** Wait until this person's answers have been saved (the submit is async). */
export async function expectAnswerCount(userId: string, count: number) {
  await expect
    .poll(
      async () => {
        const { count: n } = await admin
          .from("prompt_responses")
          .select("instance_id", { count: "exact", head: true })
          .eq("user_id", userId);
        return n ?? 0;
      },
      { message: `saved answer sets for ${userId}`, timeout: 20_000 },
    )
    .toBe(count);
}

/** Open today's question from the hub and leave the page on its answer form. */
export async function openTodaysQuestion(page: Page, connectionId: string) {
  await page.goto(`/connections/${connectionId}`);
  const today = page.locator("#today");
  await expect(today).toBeVisible();
  await today.getByRole("link").first().click();
  await page.waitForURL(/\/prompts\//);
  await page.goto(page.url());
}

// ---------------------------------------------------------------------------
// Fake providers (e2e-core/fake-providers.mjs): what the app sent
// ---------------------------------------------------------------------------

export const FAKE_PROVIDERS_URL = `http://127.0.0.1:${process.env.E2E_FAKE_PROVIDERS_PORT || 3199}`;
// Must match playwright.core.config.ts.
export const CRON_SECRET = "e2e-cron-secret";
const STRIPE_WEBHOOK_SECRET = "whsec_e2e_fake_secret";

export interface SentEmail {
  id: string;
  idempotencyKey: string | null;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

export interface StripeCall {
  method: string;
  path: string;
  id?: string;
  params: Record<string, string>;
}

async function recorded<T>(path: string): Promise<T[]> {
  const res = await fetch(`${FAKE_PROVIDERS_URL}${path}`);
  if (!res.ok) throw new Error(`fake providers ${path}: ${res.status}`);
  return (await res.json()) as T[];
}

/** Every email the app has handed to the (fake) provider for this address. */
export async function emailsTo(address: string, subject?: RegExp): Promise<SentEmail[]> {
  const all = await recorded<SentEmail>("/__emails");
  return all.filter((m) => m.to.includes(address) && (!subject || subject.test(m.subject)));
}

/**
 * Wait for one email to this address. Notification sends run after the
 * response (next/server `after`), so they land a moment after the action.
 */
export async function waitForEmail(address: string, subject: RegExp): Promise<SentEmail> {
  await expect
    .poll(async () => (await emailsTo(address, subject)).length, {
      message: `an email to ${address} matching ${subject}`,
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  return (await emailsTo(address, subject))[0]!;
}

export async function stripeCalls(match: (call: StripeCall) => boolean): Promise<StripeCall[]> {
  return (await recorded<StripeCall>("/__stripe")).filter(match);
}

/** The URL in a List-Unsubscribe header (`<https://…>`). */
export function unsubscribeLink(mail: SentEmail): string {
  const header = mail.headers["List-Unsubscribe"] ?? "";
  const url = /^<(.+)>$/.exec(header)?.[1];
  if (!url) throw new Error(`no List-Unsubscribe URL on "${mail.subject}"`);
  return url;
}

/**
 * Deliver a Stripe event to the app's webhook the way Stripe does: the raw
 * JSON body signed with the endpoint secret (`t=…,v1=HMAC(t.body)`).
 */
export async function deliverStripeEvent(
  request: APIRequestContext,
  type: string,
  object: Record<string, unknown>,
  opts: { id?: string; signature?: string } = {},
) {
  const id = opts.id ?? `evt_e2e_${randomUUID().replace(/-/g, "")}`;
  const body = JSON.stringify({
    id,
    object: "event",
    api_version: "2026-10-28.endive",
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object },
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
  const response = await request.post("/api/stripe/webhook", {
    headers: {
      "content-type": "application/json",
      "stripe-signature": opts.signature ?? `t=${t},v1=${v1}`,
    },
    data: body,
  });
  return { id, response };
}

/**
 * Answer the analytics banner up front. It is fixed to the bottom of public
 * pages (pricing) and must not sit over the button a test is about to press.
 */
export async function declineAnalytics(page: Page) {
  await page.context().addInitScript(() => {
    try {
      window.localStorage.setItem("rc-analytics-consent", "denied");
    } catch {
      // storage unavailable: the banner stays, which is only cosmetic here
    }
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
}
