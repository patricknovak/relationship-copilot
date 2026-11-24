import type { Browser, Page } from "@playwright/test";
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
