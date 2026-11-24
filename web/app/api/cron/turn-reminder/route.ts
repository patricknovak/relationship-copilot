import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCronBearer } from "@/lib/cronAuth";
import { notificationsConfigured, notifyUser, type NotifyOutcome } from "@/lib/notify";
import { emailConfigProblem, notificationConfigReport } from "@/lib/notifyConfig";
import { reportRequestError } from "@/lib/errorReporting";
import { onePerRecipientInWindow } from "@/lib/reminderBatch";
import { cronBatchSummary } from "@/lib/cronBatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The hourly "it's on you" job. Two passes, both inside the connection's
// local 9am–8pm window, both through notifyUser (preference check and the
// once-only claim in notification_log), and never more than one email per
// person per run however many sets are waiting on them:
//
// 1. Missed notifications (migration 0046, missed_notification_candidates).
//    "Your turn" and "you both answered" are sent once at submit; if that
//    send didn't deliver (provider outage, the Worker cut off, email not
//    configured at the time) this is what tries again. Selection is from
//    state, so it also works as the catch-up when email is first switched
//    on: each person still being waited on gets one "your turn" for their
//    latest set, not one per set. If the migration isn't applied yet the
//    pass reports "unavailable" and the job carries on.
//
// 2. "Still your turn": one follow-up when a shared set (first questions, a
//    quiz or a challenge) has waited 36+ hours on one person
//    (turn_reminder_candidates, migration 0036). Once per set per person,
//    and held back a day for anyone who had a "your turn" or a reminder in
//    the last 22 hours, so a backlog arrives as one email a day rather than
//    one an hour.
//
// Selection runs server-side: ids, a timezone and a first name only, never
// answer content. Batches are capped (Worker subrequest budget); the
// once-only log means the next hourly run takes whoever is left.
const SEND_HOUR_FROM = 9;
const SEND_HOUR_TO = 20;
const MIN_HOURS = 36;
const MAX_HOURS = 7 * 24;
const MAX_RECIPIENTS = 100;
// Missed-notification sweep. Ten minutes so a send still in flight isn't
// raced; "your turn" stays worth sending for two weeks (it is still true),
// a reveal for a day (after that they have very likely read it in the app).
const SWEEP_MIN_MINUTES = 10;
const SWEEP_TURN_MAX_HOURS = 14 * 24;
const SWEEP_REVEAL_MAX_HOURS = 24;
const SWEEP_MAX = 50;
const RECENT_NUDGE_HOURS = 22;
// PostgREST: function not found (migration 0046 not applied yet).
const FUNCTION_NOT_FOUND = "PGRST202";

type Counts = { candidates: number; outside_window: number; held: number; sent: number; skipped: number; failed: number };
const emptyCounts = (): Counts => ({ candidates: 0, outside_window: 0, held: 0, sent: 0, skipped: 0, failed: 0 });

function tally(counts: Counts, outcome: NotifyOutcome) {
  if (outcome === "sent") counts.sent += 1;
  else if (outcome === "failed") counts.failed += 1;
  else counts.skipped += 1;
}

async function run(req: Request) {
  if (!authorizeCronBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A production Worker without email is a misconfiguration: say so every
  // tick (Sentry issue + the cron log line) instead of skipping quietly.
  const config = notificationConfigReport();
  const problem = emailConfigProblem();
  if (problem) {
    console.error(JSON.stringify({ event: "notify_misconfigured", missing: config.missing }));
    reportRequestError(problem, {
      method: "POST",
      routePath: "/api/cron/turn-reminder",
      routeType: "route",
    });
  }
  // Nothing to send without a channel; don't query the database every hour.
  if (!notificationsConfigured()) {
    return NextResponse.json({ skipped: "notifications not configured", config });
  }

  const admin = createAdminClient();
  const now = new Date();
  // Recipients who already have a nudge from this run.
  const taken = new Set<string>();

  // --- 1. Missed "your turn" / "revealed" ---------------------------------
  const sweep: Counts & { status: "ok" | "unavailable" | "failed" } = { status: "ok", ...emptyCounts() };
  const { data: missed, error: missedError } = await admin.rpc("missed_notification_candidates", {
    p_min_minutes: SWEEP_MIN_MINUTES,
    p_turn_max_hours: SWEEP_TURN_MAX_HOURS,
    p_reveal_max_hours: SWEEP_REVEAL_MAX_HOURS,
    p_limit: SWEEP_MAX,
  });
  if (missedError) {
    sweep.status = missedError.code === FUNCTION_NOT_FOUND ? "unavailable" : "failed";
    if (sweep.status === "failed") {
      console.error("[turn-reminder] missed candidates failed", missedError.code ?? "");
    }
  } else {
    const rows = missed ?? [];
    sweep.candidates = rows.length;
    const batch = onePerRecipientInWindow(rows, now, SEND_HOUR_FROM, SEND_HOUR_TO, taken);
    sweep.outside_window = batch.outsideWindow;
    sweep.held = batch.held;
    for (const pick of batch.send) {
      const outcome = await notifyUser({
        admin,
        userId: pick.recipient_id,
        instanceId: pick.instance_id,
        connectionId: pick.connection_id,
        kind: pick.kind === "revealed" ? "revealed" : "your_turn",
        themName: pick.other_name ?? null,
        recordConfigSkip: false,
      });
      tally(sweep, outcome);
    }
  }

  // --- 2. 36-hour "still your turn" ---------------------------------------
  const counts = emptyCounts();
  const { data: picks, error } = await admin.rpc("turn_reminder_candidates", {
    p_min_hours: MIN_HOURS,
    p_max_hours: MAX_HOURS,
    p_limit: MAX_RECIPIENTS + 1,
  });
  if (error) {
    console.error("[turn-reminder] candidates failed", error.message);
    return NextResponse.json({ error: "candidates failed", sweep, config }, { status: 500 });
  }
  const { batch: capped, more } = cronBatchSummary(picks ?? [], MAX_RECIPIENTS);
  counts.candidates = capped.length;

  // Anyone nudged in the last 22 hours waits for tomorrow's run.
  const recipients = [...new Set(capped.map((p) => p.recipient_id))];
  if (recipients.length > 0) {
    const since = new Date(now.getTime() - RECENT_NUDGE_HOURS * 3_600_000).toISOString();
    const { data: recent, error: recentError } = await admin
      .from("notification_log")
      .select("user_id")
      .in("user_id", recipients)
      .in("kind", ["your_turn", "turn_reminder"])
      .gte("sent_at", since);
    if (recentError) {
      // Without this check a backlog could go out hourly; skip the pass
      // instead and let the next run try again.
      console.error("[turn-reminder] recent-nudge lookup failed", recentError.code ?? "");
      return NextResponse.json({ error: "recent lookup failed", sweep, config }, { status: 500 });
    }
    for (const row of recent ?? []) taken.add(row.user_id);
  }

  const reminders = onePerRecipientInWindow(capped, now, SEND_HOUR_FROM, SEND_HOUR_TO, taken);
  counts.outside_window = reminders.outsideWindow;
  counts.held = reminders.held;
  for (const pick of reminders.send) {
    // notifyUser checks the "your turn" preference and the once-only claim.
    const outcome = await notifyUser({
      admin,
      userId: pick.recipient_id,
      instanceId: pick.instance_id,
      connectionId: pick.connection_id,
      kind: "turn_reminder",
      themName: pick.answered_by_name ?? null,
      recordConfigSkip: false,
    });
    tally(counts, outcome);
  }

  return NextResponse.json({ at: now.toISOString(), ...counts, more, sweep, config });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
