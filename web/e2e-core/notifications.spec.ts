import { expect, test } from "@playwright/test";
import {
  admin,
  answerAll,
  connectedPair,
  CRON_SECRET,
  emailsTo,
  expectAnswerCount,
  openTodaysQuestion,
  pinDailyToFreeText,
  unsubscribeLink,
  waitForEmail,
} from "./helpers";

// Every email below is handed to e2e-core/fake-providers.mjs on loopback,
// never to the real provider. What is checked is what the app would have
// sent: who to, the subject, the link, the unsubscribe headers, and that no
// answer text is in it.

test("each step of the loop emails the other person, and never their words", async ({
  browser,
}) => {
  const stamp = Date.now();
  const SAM_FIRST = `Sam first set ${stamp}`;
  const ALEX_FIRST = `Alex first set ${stamp}`;
  const SAM_DAILY = `Sam daily ${stamp}`;
  const ALEX_DAILY = `Alex daily ${stamp}`;
  const SAM_REPLY = `Sam reply ${stamp}`;
  const { sam, alex, s, a, connectionId } = await connectedPair(browser, {
    firstSetAnswer: SAM_FIRST,
  });

  // Alex accepted the invite: Sam hears about it.
  const joined = await waitForEmail(sam.email, /^Alex joined/);
  expect(joined.text).toContain(`/connections/${connectionId}`);

  // Alex answers the first set, which opens the reveal: Sam hears about that.
  await a.goto(`/connections/${connectionId}/onboarding`);
  await answerAll(a, ALEX_FIRST);
  await expect(a.getByRole("heading", { name: "You revealed together." })).toBeVisible();
  const firstReveal = await waitForEmail(sam.email, /^You and Alex both answered/);
  expect(firstReveal.text).not.toContain(ALEX_FIRST);
  expect(firstReveal.text).not.toContain(SAM_FIRST);

  // Today's question: Alex answers first, so it is Sam's turn.
  await pinDailyToFreeText(connectionId);
  await openTodaysQuestion(a, connectionId);
  const dailyUrl = new URL(a.url());
  await answerAll(a, ALEX_DAILY);
  const turn = await waitForEmail(sam.email, /^Alex answered — your turn/);
  expect(turn.to).toEqual([sam.email]);
  expect(turn.text).toContain(dailyUrl.pathname);
  for (const part of [turn.text, turn.html, turn.subject]) {
    expect(part).not.toContain(ALEX_DAILY);
  }
  // One-click unsubscribe headers (RFC 8058) and a stable idempotency key.
  expect(turn.headers["List-Unsubscribe"]).toMatch(
    /^<http:\/\/localhost:\d+\/api\/notifications\/unsubscribe\?u=[0-9a-f-]{36}&t=[0-9a-f]{64}>$/,
  );
  expect(turn.headers["List-Unsubscribe"]).toContain(`u=${sam.id}`);
  expect(turn.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  expect(turn.idempotencyKey).toMatch(new RegExp(`^notify/your_turn/[0-9a-f-]{36}/${sam.id}$`));

  // Sam follows the link in the email, answers, and Alex hears the reveal
  // is open.
  const link = /Answer now: (\S+)/.exec(turn.text)?.[1];
  expect(link).toBeTruthy();
  await s.goto(new URL(link!).pathname);
  await expect(s.locator("body")).not.toContainText(ALEX_DAILY);
  await answerAll(s, SAM_DAILY);
  await expect(s.locator("body")).toContainText(ALEX_DAILY);
  const dailyReveal = await waitForEmail(alex.email, /^You and Sam both answered/);
  expect(dailyReveal.text).not.toContain(SAM_DAILY);
  expect(dailyReveal.text).not.toContain(ALEX_DAILY);

  // Sam writes under the reveal: Alex gets one email, without the message.
  await s.getByLabel("Message", { exact: true }).fill(SAM_REPLY);
  await s.getByRole("button", { name: "Send", exact: true }).click();
  const reply = await waitForEmail(alex.email, /^Sam wrote something under your reveal/);
  expect(reply.text).not.toContain(SAM_REPLY);
  expect(reply.html).not.toContain(SAM_REPLY);

  // Nobody was emailed about their own action, and nothing went out twice.
  expect(await emailsTo(alex.email, /^Alex/)).toHaveLength(0);
  expect(await emailsTo(sam.email, /^Alex answered — your turn/)).toHaveLength(1);
  expect(await emailsTo(alex.email, /^You and Sam both answered/)).toHaveLength(1);
});

test("the unsubscribe link in an email stops notifications, but only once confirmed", async ({
  browser,
  request,
}) => {
  const stamp = Date.now();
  const { sam, alex, s, a, connectionId } = await connectedPair(browser, {
    firstSetAnswer: `Sam first set ${stamp}`,
  });
  const joined = await waitForEmail(sam.email, /^Alex joined/);
  const link = unsubscribeLink(joined);
  const unsubscribePath = `${new URL(link).pathname}${new URL(link).search}`;

  const notificationPrefs = async () => {
    const { data } = await admin.from("profiles").select("preferences").eq("id", sam.id).single();
    return ((data?.preferences ?? {}) as { notifications?: Record<string, boolean> }).notifications;
  };

  // A tampered link changes nothing.
  const forged = await request.post(unsubscribePath.replace(/t=[0-9a-f]{8}/, "t=00000000"));
  expect(forged.status()).toBe(400);

  // Opening the link (as a mail scanner would) only asks; nothing changes yet.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(unsubscribePath);
  await expect(visitor.getByRole("heading", { name: "Stop notification emails?" })).toBeVisible();
  expect((await notificationPrefs())?.your_turn).not.toBe(false);

  // Confirming does it, without signing in.
  await visitor.getByRole("button", { name: "Yes, stop these emails" }).click();
  await expect(visitor.getByRole("heading", { name: "You're unsubscribed" })).toBeVisible();
  expect(await notificationPrefs()).toEqual({
    your_turn: false,
    revealed: false,
    daily_ready: false,
    discussion_reply: false,
  });

  // Alex opens the first reveal: Sam would have been emailed, and is not.
  // Alex's own notifications still work (Sam's reply arrives), which also
  // shows the reveal's send had its chance before we look.
  await a.goto(`/connections/${connectionId}/onboarding`);
  await answerAll(a, `Alex first set ${stamp}`);
  await expect(a.getByRole("heading", { name: "You revealed together." })).toBeVisible();
  await s.goto(`/connections/${connectionId}/onboarding`);
  await s.getByLabel("Message", { exact: true }).fill(`Sam reply ${stamp}`);
  await s.getByRole("button", { name: "Send", exact: true }).click();
  await waitForEmail(alex.email, /^Sam wrote something under your reveal/);
  expect(await emailsTo(sam.email, /both answered/)).toHaveLength(0);

  // Sam's account page shows the switches off.
  await s.goto("/account");
  for (const box of await s.locator('input[type="checkbox"][name="your_turn"], input[type="checkbox"][name="revealed"]').all()) {
    await expect(box).not.toBeChecked();
  }
});

test("the hourly job re-sends a missed 'your turn' once, in the recipient's daytime", async ({
  browser,
  request,
}) => {
  const stamp = Date.now();
  const { sam, alex, connectionId } = await connectedPair(browser, {
    firstSetAnswer: `Sam first set ${stamp}`,
  });
  await waitForEmail(sam.email, /^Alex joined/);

  // A zone where it is mid-day right now, so the 9am-8pm window is open
  // whenever CI happens to run.
  const zones = [
    "UTC",
    "Asia/Tokyo",
    "Asia/Kolkata",
    "Europe/Berlin",
    "America/Sao_Paulo",
    "America/New_York",
    "America/Los_Angeles",
    "Pacific/Auckland",
  ];
  const hourIn = (timeZone: string) =>
    Number(
      new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(
        new Date(),
      ),
    );
  const zone = zones.find((z) => hourIn(z) >= 10 && hourIn(z) <= 18);
  expect(zone, "a zone where it is daytime").toBeTruthy();

  // Sam answered today's question an hour ago and the "your turn" email
  // never went out (written straight to the database: no app, no send).
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  expect(
    (await admin.from("connections").update({ timezone: zone! }).eq("id", connectionId)).error,
  ).toBeNull();
  expect(
    (
      await admin
        .from("connection_members")
        .update({ joined_at: twoHoursAgo })
        .eq("connection_id", connectionId)
    ).error,
  ).toBeNull();
  // The job nudges about each person's latest waiting set only, so Sam's
  // first-set answer has to be older than the missed daily one.
  const { data: backdated, error: backdateError } = await admin
    .from("prompt_responses")
    .update({ submitted_at: new Date(Date.now() - 90 * 60_000).toISOString() })
    .eq("user_id", sam.id)
    .select("submitted_at");
  expect(backdateError).toBeNull();
  expect(backdated).toHaveLength(1);
  expect(Date.now() - new Date(backdated![0]!.submitted_at).getTime()).toBeGreaterThan(80 * 60_000);
  const { data: instanceId, error: dailyError } = await admin.rpc("ensure_daily_prompt", {
    p_conn: connectionId,
  });
  expect(dailyError).toBeNull();
  const { data: instance } = await admin
    .from("prompt_instances")
    .select("questions")
    .eq("id", instanceId)
    .single();
  const firstQuestion = (instance!.questions as Array<{ id: string }>)[0]!.id;
  expect(
    (
      await admin.from("prompt_responses").insert({
        instance_id: instanceId,
        user_id: sam.id,
        answers: { [firstQuestion]: `Sam missed ${stamp}` },
        submitted_at: oneHourAgo,
      })
    ).error,
  ).toBeNull();

  const tick = () =>
    request.post("/api/cron/turn-reminder", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

  const first = await tick();
  expect(first.status()).toBe(200);
  const report = await first.json();
  expect(report.config.email).toBe(true);
  expect(report.sweep.status).toBe("ok");
  expect(report.sweep.sent).toBeGreaterThanOrEqual(1);

  const nudge = await waitForEmail(alex.email, /^Sam answered — your turn/);
  expect(nudge.text).toContain(`/connections/${connectionId}/prompts/${instanceId}`);
  expect(nudge.text).not.toContain(`Sam missed ${stamp}`);

  // The next tick does not send it again.
  expect((await tick()).status()).toBe(200);
  expect(await emailsTo(alex.email, /^Sam answered — your turn/)).toHaveLength(1);

  // The daily-reminder job runs too (nobody here opted in, so no email).
  const daily = await request.post("/api/cron/daily-reminder", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(daily.status()).toBe(200);
  expect(await emailsTo(alex.email, /^Today's question is ready/)).toHaveLength(0);
  await expectAnswerCount(alex.id, 0);
});
