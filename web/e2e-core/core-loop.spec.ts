import { expect, test } from "@playwright/test";
import { admin, answerAll, makeUser, signedInPage } from "./helpers";

// The product's core promise, end to end through the real app and a real
// (local) Supabase with every migration applied: two people connect, answer
// in private, and see each other's words only after both have shared.
test("invite, join, answer in private, reveal together", async ({ browser }) => {
  const sam = await makeUser("sam", "Sam");
  const alex = await makeUser("alex", "Alex");
  const SAM_WORDS = `Sam private answer ${Date.now()}`;
  const ALEX_WORDS = `Alex private answer ${Date.now()}`;

  // Sam creates a sibling connection.
  const s = await signedInPage(browser, sam.email, "/connections/new");
  await s.getByText(/sibling/i).first().click();
  await s.getByRole("button", { name: /create|start|continue|next/i }).first().click();
  // createConnection lands on #invite so sharing is one scroll away.
  await s.waitForURL(/\/connections\/[0-9a-f-]{36}(?:#invite)?$/);
  const connectionId = s.url().split("/").pop()!.split("#")[0]!;
  await expect(s.getByRole("heading", { name: "Waiting for your person" })).toBeVisible();

  const { data: conn } = await admin
    .from("connections")
    .select("invite_code")
    .eq("id", connectionId)
    .single();
  const code = conn!.invite_code as string;

  // Alex opens the invite signed out, then signs in through it and lands in.
  const a = await signedInPage(browser, alex.email, `/invite/${code}`);
  await a.waitForURL(new RegExp(`/connections/${connectionId}`));

  // Sam answers first.
  await s.goto(`/connections/${connectionId}/onboarding`);
  await answerAll(s, SAM_WORDS);
  await expect(s.getByRole("heading", { name: /waiting on them/i })).toBeVisible();

  // Alex learns only that Sam answered; Sam's words are nowhere on the page.
  await a.goto(`/connections/${connectionId}`);
  await expect(a.getByRole("heading", { name: "They're ready when you are." })).toBeVisible();
  await a.goto(`/connections/${connectionId}/onboarding`);
  await expect(a.locator("body")).not.toContainText(SAM_WORDS);

  // Alex answers: the reveal opens for both, with both people's words.
  await answerAll(a, ALEX_WORDS);
  await expect(a.getByRole("heading", { name: "You revealed together." })).toBeVisible();
  await expect(a.locator("body")).toContainText(SAM_WORDS);
  await expect(a.locator("body")).toContainText(ALEX_WORDS);

  await s.goto(`/connections/${connectionId}/onboarding`);
  await expect(s.locator("body")).toContainText(ALEX_WORDS);
});

test("an outsider can't open someone else's connection", async ({ browser }) => {
  const owner = await makeUser("owner", "Owner");
  const outsider = await makeUser("outsider", "Out");
  const o = await signedInPage(browser, owner.email, "/connections/new");
  await o.getByText(/friend/i).first().click();
  await o.getByRole("button", { name: /create|start|continue|next/i }).first().click();
  await o.waitForURL(/\/connections\/[0-9a-f-]{36}(?:#invite)?$/);
  const connectionId = o.url().split("/").pop()!.split("#")[0]!;

  // The route streams (loading.tsx), so the status can be 200; what matters
  // is that RLS finds nothing and the not-found page renders instead.
  const x = await signedInPage(browser, outsider.email, `/connections/${connectionId}`);
  await x.goto(`/connections/${connectionId}`);
  await expect(x.getByRole("heading", { name: "This page drifted apart" })).toBeVisible();
  await expect(x.getByRole("heading", { name: "Waiting for your person" })).toHaveCount(0);
});
