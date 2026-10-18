import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCronBearer } from "@/lib/cronAuth";
import { notifyUser } from "@/lib/notify";
import { localHour } from "@/lib/dailyReminderBatch";
import { cronBatchSummary } from "@/lib/cronBatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Still your turn": one follow-up when a shared set (first questions, a quiz
// or a challenge) has waited 36+ hours on one person. The first "your turn"
// fires at submit; this is the only other one, once per set per person
// (notification_log, kind turn_reminder), inside the connection's local
// 9am–8pm window, and only for people with the "your turn" switch on.
// Selection runs server-side in turn_reminder_candidates (migration 0036):
// ids, a timezone and a first name only, never answer content. The batch is
// capped like daily-reminder (Worker subrequest budget); the once-only log
// means the next hourly run takes whoever is left.
const SEND_HOUR_FROM = 9;
const SEND_HOUR_TO = 20;
const MIN_HOURS = 36;
const MAX_HOURS = 7 * 24;
const MAX_RECIPIENTS = 100;

async function run(req: Request) {
  if (!authorizeCronBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const counts = { candidates: 0, outside_window: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: picks, error } = await admin.rpc("turn_reminder_candidates", {
    p_min_hours: MIN_HOURS,
    p_max_hours: MAX_HOURS,
    p_limit: MAX_RECIPIENTS + 1,
  });
  if (error) {
    console.error("[turn-reminder] candidates failed", error.message);
    return NextResponse.json({ error: "candidates failed" }, { status: 500 });
  }
  const { batch, more } = cronBatchSummary(picks ?? [], MAX_RECIPIENTS);
  counts.candidates = batch.length;

  for (const pick of batch) {
    const hour = localHour(pick.timezone, now);
    if (hour < SEND_HOUR_FROM || hour > SEND_HOUR_TO) {
      counts.outside_window += 1;
      continue;
    }
    // notifyUser checks config, the "your turn" preference and the
    // once-only claim; with no channel configured it is a cheap skip.
    const outcome = await notifyUser({
      admin,
      userId: pick.recipient_id,
      instanceId: pick.instance_id,
      connectionId: pick.connection_id,
      kind: "turn_reminder",
      themName: pick.answered_by_name ?? null,
    });
    if (outcome === "sent") counts.sent += 1;
    else if (outcome === "failed") counts.failed += 1;
    else counts.skipped += 1;
  }

  return NextResponse.json({ at: now.toISOString(), ...counts, more });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
