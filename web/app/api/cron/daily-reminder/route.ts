import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCronBearer } from "@/lib/cronAuth";
import { notificationsConfigured, notifyUser } from "@/lib/notify";
import { cronBatchSummary } from "@/lib/cronBatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily "today's question is ready" reminder. Opt-in per user (Account →
// Notifications), one notification per person per connection per local day,
// enforced by notification_log. Called hourly by the Worker Cron Trigger
// with the CRON_SECRET bearer token; each connection is reminded only inside
// its own local sending window, so the run is safe to repeat and zone-aware.
//
// Selection runs in SQL (migration 0040): ensure_daily_prompts_in_window
// creates the missing "today" instances in one round trip, and
// daily_reminder_candidates returns at most MAX_RECIPIENTS people who are
// opted in, haven't answered and haven't been reminded. Each notifyUser is
// several subrequests (profile, devices, claim, address, send, audit), and a
// Worker invocation has a fixed subrequest budget, so the batch is capped;
// the once-only claim means the next hourly run picks up whoever is left,
// and the response says so (`more`).
const SEND_HOUR_FROM = 9; // local hour, inclusive
const SEND_HOUR_TO = 20; // local hour, inclusive
const MAX_RECIPIENTS = 100;
const MAX_ENSURE = 2000;

async function run(req: Request) {
  if (!authorizeCronBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!notificationsConfigured()) {
    return NextResponse.json({ skipped: "notifications not configured" });
  }

  const admin = createAdminClient();
  const now = new Date();
  const counts = { created: 0, candidates: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: created, error: ensureError } = await admin.rpc(
    "ensure_daily_prompts_in_window",
    { p_from_hour: SEND_HOUR_FROM, p_to_hour: SEND_HOUR_TO, p_limit: MAX_ENSURE },
  );
  if (ensureError) {
    console.error("[daily-reminder] ensure failed", ensureError.message);
    return NextResponse.json({ error: "ensure failed" }, { status: 500 });
  }
  counts.created = created ?? 0;

  // Ask for one more than the batch so the response can say whether a
  // backlog remains; only MAX_RECIPIENTS are notified this run.
  const { data: picks, error } = await admin.rpc("daily_reminder_candidates", {
    p_from_hour: SEND_HOUR_FROM,
    p_to_hour: SEND_HOUR_TO,
    p_limit: MAX_RECIPIENTS + 1,
  });
  if (error) {
    console.error("[daily-reminder] candidates failed", error.message);
    return NextResponse.json({ error: "candidates failed" }, { status: 500 });
  }
  const { batch, more } = cronBatchSummary(picks ?? [], MAX_RECIPIENTS);
  counts.candidates = batch.length;

  for (const pick of batch) {
    const outcome = await notifyUser({
      admin,
      userId: pick.recipient_id,
      instanceId: pick.instance_id,
      connectionId: pick.connection_id,
      kind: "daily_ready",
      themName: pick.other_name ?? null,
      questionText: pick.question_text ?? null,
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
