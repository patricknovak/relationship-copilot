import { expect, test } from "@playwright/test";
import { admin, answerAll, makeUser, signedInPage } from "./helpers";

// The 2026-10-28 launch-readiness changes, end to end against a local
// Supabase with every migration applied (0042: daily from join).
test("today's question opens the day both join; the invitee names themselves in place", async ({
  browser,
}) => {
  const sam = await makeUser("sam-ready", "Sam");
  const alex = await makeUser("alex-ready", ""); // joins before choosing a name
  const SAM_DAILY = `Sam daily ${Date.now()}`;
  const ALEX_DAILY = `Alex daily ${Date.now()}`;

  const s = await signedInPage(browser, sam.email, "/connections/new");
  await s.getByText(/friend/i).first().click();
  await s.getByRole("button", { name: /create|start|continue|next/i }).first().click();
  await s.waitForURL(/\/connections\/[0-9a-f-]{36}(?:#invite)?$/);
  const connectionId = s.url().split("/").pop()!.split("#")[0]!;

  // Sam answers the first set before Alex joins (answer-first, from the hub):
  // the wait then gets something to do.
  await s.getByRole("button", { name: "Answer yours now" }).click();
  await s.waitForURL(new RegExp(`/connections/${connectionId}/onboarding`));
  await s.goto(`/connections/${connectionId}/onboarding`);
  await answerAll(s, "Sam first set");
  await s.goto(`/connections/${connectionId}`);
  await expect(s.getByText("While you wait")).toBeVisible();

  const { data: conn } = await admin
    .from("connections")
    .select("invite_code")
    .eq("id", connectionId)
    .single();

  // Alex joins and is asked for a name on the questions page, saved in place.
  const a = await signedInPage(browser, alex.email, `/invite/${conn!.invite_code}`);
  await a.waitForURL(new RegExp(`/connections/${connectionId}`));
  await a.goto(`/connections/${connectionId}/onboarding`);
  const nameField = a.getByLabel("First, what should we call you?");
  await expect(nameField).toBeVisible();
  await nameField.fill("Alex");
  await a.getByRole("button", { name: "Save" }).click();
  await expect(a.getByText(/Thanks, Alex/)).toBeVisible();

  // The first set is still open, and today's question is already there.
  await a.goto(`/connections/${connectionId}`);
  const todayA = a.locator("#today");
  await expect(todayA).toBeVisible();
  await todayA.getByRole("link").first().click();
  await a.waitForURL(/\/prompts\//);
  await a.goto(a.url());
  await answerAll(a, ALEX_DAILY);

  // One answer each reveals today's question: no 40-answer wall first.
  await s.goto(`/connections/${connectionId}`);
  await s.locator("#today").getByRole("link").first().click();
  await s.waitForURL(/\/prompts\//);
  await s.goto(s.url());
  await expect(s.locator("body")).not.toContainText(ALEX_DAILY);
  await answerAll(s, SAM_DAILY);
  await expect(s.locator("body")).toContainText(ALEX_DAILY);
  await expect(s.locator("body")).toContainText(SAM_DAILY);
  await expect(s.locator("body")).toContainText("Alex");
});

test("nothing AI is offered or sold while the AI provider is off", async ({ browser }) => {
  // This stack has no XAI key, so production rules treat the AI as off.
  const owner = await makeUser("ai-off", "Pat");
  const p = await signedInPage(browser, owner.email, "/connections/new");
  await p.getByText(/friend/i).first().click();
  await p.getByRole("button", { name: /create|start|continue|next/i }).first().click();
  await p.waitForURL(/\/connections\/[0-9a-f-]{36}(?:#invite)?$/);
  const connectionId = p.url().split("/").pop()!.split("#")[0]!;

  await p.goto(`/connections/${connectionId}/blueprint`);
  await expect(p.getByRole("heading", { name: "Switching on soon" })).toBeVisible();
  await expect(p.getByRole("button", { name: /generate/i })).toHaveCount(0);

  await p.goto("/pricing");
  await expect(p.getByText("Opening soon")).toBeVisible();
  await expect(p.getByRole("button", { name: /upgrade to premium/i })).toHaveCount(0);
});
