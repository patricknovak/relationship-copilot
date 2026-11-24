import { expect, test } from "@playwright/test";
import { admin, answerAll, makeUser, signedInPage } from "./helpers";

// A new daily question opens every local day, so two people who answer on
// different days never land on the same one. The hub has to bring the
// earlier day back to whoever still owes an answer, or it never reveals.
test("an earlier day the other person answered comes back as waiting on you", async ({
  browser,
}) => {
  const sam = await makeUser("sam", "Sam");
  const alex = await makeUser("alex", "Alex");
  const SAM_WORDS = `Sam earlier answer ${Date.now()}`;
  const ALEX_WORDS = `Alex late answer ${Date.now()}`;
  const QUESTION = `Catch-up question ${Date.now()}?`;

  const s = await signedInPage(browser, sam.email, "/connections/new");
  await s.getByText(/sibling/i).first().click();
  await s.getByRole("button", { name: /create|start|continue|next/i }).first().click();
  await s.waitForURL(/\/connections\/[0-9a-f-]{36}(?:#invite)?$/);
  const connectionId = s.url().split("/").pop()!.split("#")[0]!;

  const { data: conn } = await admin
    .from("connections")
    .select("invite_code, timezone")
    .eq("id", connectionId)
    .single();
  const a = await signedInPage(browser, alex.email, `/invite/${conn!.invite_code}`);
  await a.waitForURL(new RegExp(`/connections/${connectionId}`));

  // Two days ago in the connection's zone: "earlier" whatever the hour is.
  const earlier = new Intl.DateTimeFormat("en-CA", {
    timeZone: (conn!.timezone as string) || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - 48 * 60 * 60 * 1000));
  const { data: past, error: pastErr } = await admin
    .from("prompt_instances")
    .insert({
      connection_id: connectionId,
      kind: "daily",
      status: "open",
      scheduled_for: earlier,
      questions: [{ id: "q1", text: QUESTION, format: "text" }],
    })
    .select("id")
    .single();
  expect(pastErr).toBeNull();
  // Sam answered that day; Alex never opened the app.
  const { error: respErr } = await admin
    .from("prompt_responses")
    .insert({ instance_id: past!.id, user_id: sam.id, answers: { q1: SAM_WORDS } });
  expect(respErr).toBeNull();

  // Alex comes back: the hub shows today's question AND the earlier one,
  // without Sam's words.
  await a.goto(`/connections/${connectionId}`);
  await expect(
    a.getByRole("heading", { name: "Sam is waiting on your answer." }),
  ).toBeVisible();
  await expect(a.locator("body")).not.toContainText(SAM_WORDS);
  await a.getByRole("link", { name: new RegExp(QUESTION.replace("?", "\\?")) }).click();
  await a.waitForURL(new RegExp(`/prompts/${past!.id}`));

  // It is named by its date, not passed off as today's question.
  await expect(a.locator("body")).toContainText("Question from ");
  await expect(a.locator("body")).not.toContainText(SAM_WORDS);

  // Alex answers and the earlier day reveals for both.
  await answerAll(a, ALEX_WORDS);
  await expect(a.locator("body")).toContainText(SAM_WORDS);
  await expect(a.locator("body")).toContainText(ALEX_WORDS);

  // Nothing is left waiting on Alex.
  await a.goto(`/connections/${connectionId}`);
  await expect(a.getByRole("heading", { name: /waiting on your answer/i })).toHaveCount(0);
});
