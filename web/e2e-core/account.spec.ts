import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  admin,
  answerAll,
  connectedPair,
  makeUser,
  signedInPage,
  startConnection,
  stripeCalls,
} from "./helpers";

test("data export downloads your own data and never the other person's sealed answer", async ({
  browser,
}) => {
  const SAM_WORDS = `Sam sealed answer ${Date.now()}`;
  const { sam, alex, s, a, connectionId } = await connectedPair(browser, {
    firstSetAnswer: SAM_WORDS,
  });

  // Sam downloads from the account page.
  await s.goto("/account");
  const [download] = await Promise.all([
    s.waitForEvent("download"),
    s.getByRole("link", { name: "Export now" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("relationship-copilot-export.json");
  const mine = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(mine.account).toEqual({ id: sam.id, email: sam.email });
  expect(mine.connections.map((c: { id: string }) => c.id)).toContain(connectionId);
  expect(mine.prompt_responses).toHaveLength(1);
  expect(JSON.stringify(mine.prompt_responses)).toContain(SAM_WORDS);
  // The questions those answers belong to come with them.
  expect(mine.prompts.length).toBeGreaterThan(0);

  // Alex has joined but not answered: Sam's words are sealed, so Alex's
  // export has nothing of Sam's in it.
  const res = await a.request.get("/api/account/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("attachment");
  const theirsText = await res.text();
  const theirs = JSON.parse(theirsText);
  expect(theirs.account).toEqual({ id: alex.id, email: alex.email });
  expect(theirs.prompt_responses).toHaveLength(0);
  expect(theirsText).not.toContain(SAM_WORDS);
  expect(theirsText).not.toContain(sam.email);

  // Each export is in the audit trail.
  const { count } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "account.export")
    .in("user_id", [sam.id, alex.id]);
  expect(count).toBe(2);
});

test("deleting an account removes that person's words; the other keeps theirs, archived", async ({
  browser,
}) => {
  const SAM_WORDS = `Sam leaving answer ${Date.now()}`;
  const ALEX_WORDS = `Alex staying answer ${Date.now()}`;
  const { sam, alex, s, a, connectionId } = await connectedPair(browser, {
    firstSetAnswer: SAM_WORDS,
  });
  await a.goto(`/connections/${connectionId}/onboarding`);
  await answerAll(a, ALEX_WORDS);
  await expect(a.getByRole("heading", { name: "You revealed together." })).toBeVisible();
  await expect(a.locator("body")).toContainText(SAM_WORDS);

  // The button stays off until DELETE is typed.
  await s.goto("/account");
  const confirm = s.getByRole("button", { name: "Permanently delete my account" });
  await expect(confirm).toBeDisabled();
  await s.locator("#confirm-delete").fill("DELETE");
  await confirm.click();
  await s.waitForURL((url) => url.pathname === "/");

  // Sam is gone: no sign-in, no profile, no answers.
  const { data: gone } = await admin.auth.admin.getUserById(sam.id);
  expect(gone.user).toBeNull();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", sam.id).maybeSingle();
  expect(profile).toBeNull();
  const { data: responses } = await admin
    .from("prompt_responses")
    .select("user_id, answers, prompt_instances!inner(connection_id)")
    .eq("prompt_instances.connection_id", connectionId);
  expect((responses ?? []).map((r) => r.user_id)).toEqual([alex.id]);
  expect(JSON.stringify(responses)).toContain(ALEX_WORDS);
  expect(JSON.stringify(responses)).not.toContain(SAM_WORDS);

  // Alex keeps the connection, archived, with none of Sam's words on it.
  const { data: conn } = await admin
    .from("connections")
    .select("status")
    .eq("id", connectionId)
    .single();
  expect(conn!.status).toBe("archived");
  await a.goto(`/connections/${connectionId}`);
  await expect(a.getByRole("heading", { name: "This connection is archived" })).toBeVisible();
  await a.goto(`/connections/${connectionId}/onboarding`);
  await expect(a.locator("body")).not.toContainText(SAM_WORDS);

  // Sam's old browser session no longer gets in.
  await s.goto("/account");
  await s.waitForURL(/\/login/);

  // The deletion is in the audit trail, detached from the removed user.
  const { count } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "account.delete")
    .eq("user_id", sam.id);
  expect(count).toBe(0);
});

test("deleting a Premium account cancels the subscription at Stripe first", async ({ browser }) => {
  const pat = await makeUser("pat-premium", "Pat");
  const subscriptionId = `sub_e2e_${Date.now()}`;
  const { error } = await admin.from("subscriptions").upsert({
    user_id: pat.id,
    plan: "premium",
    status: "active",
    stripe_customer_id: `cus_e2e_${Date.now()}`,
    stripe_subscription_id: subscriptionId,
  });
  expect(error).toBeNull();

  // A connection nobody else joined goes away with the account.
  const p = await signedInPage(browser, pat.email, "/connections/new");
  const connectionId = await startConnection(p, /friend/i);

  await p.goto("/account");
  await p.locator("#confirm-delete").fill("DELETE");
  await p.getByRole("button", { name: "Permanently delete my account" }).click();
  await p.waitForURL((url) => url.pathname === "/");

  const cancels = await stripeCalls(
    (c) => c.method === "DELETE" && c.path === `/v1/subscriptions/${subscriptionId}`,
  );
  expect(cancels).toHaveLength(1);
  const { data: gone } = await admin.auth.admin.getUserById(pat.id);
  expect(gone.user).toBeNull();
  const { data: conn } = await admin
    .from("connections")
    .select("id")
    .eq("id", connectionId)
    .maybeSingle();
  expect(conn).toBeNull();
});
