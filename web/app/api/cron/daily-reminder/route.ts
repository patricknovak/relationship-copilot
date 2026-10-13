import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured } from "@/lib/email";
import { notifyUser } from "@/lib/notify";
import { todayUtc } from "@/lib/dailyState";
import type { PromptQuestion } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily "today's question is ready" reminder. Opt-in per user (Account →
// Notifications), one email per person per connection per day, enforced by
// notification_log. Called by a scheduler with the CRON_SECRET bearer token
// (see docs/launch-checklist.md for the pg_cron + pg_net schedule). Safe to
// call more than once a day: every send is idempotent.
const MAX_CONNECTIONS = 500;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ skipped: "email not configured" });
  }

  const admin = createAdminClient();
  const date = todayUtc();
  const counts = { connections: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: connections } = await admin
    .from("connections")
    .select("id")
    .eq("status", "active")
    .limit(MAX_CONNECTIONS);

  for (const conn of connections ?? []) {
    counts.connections += 1;
    // Service role: ensure_daily_prompt skips the membership check when
    // auth.uid() is null, which is the cron contract from migration 0004.
    const { data: instanceId } = await admin.rpc("ensure_daily_prompt", {
      p_conn: conn.id,
      p_date: date,
    });
    if (!instanceId) continue;

    const { data: instance } = await admin
      .from("prompt_instances")
      .select("id, status, questions")
      .eq("id", instanceId)
      .maybeSingle();
    if (!instance || instance.status !== "open") continue;
    const qs = Array.isArray(instance.questions)
      ? (instance.questions as PromptQuestion[])
      : [];
    const questionText = qs[0]?.text ?? null;

    const { data: members } = await admin
      .from("connection_members")
      .select("user_id")
      .eq("connection_id", conn.id)
      .not("joined_at", "is", null);
    const ids = (members ?? []).map((m) => m.user_id);
    if (ids.length < 2) continue;

    const { data: responses } = await admin
      .from("prompt_responses")
      .select("user_id")
      .eq("instance_id", instance.id);
    const answered = new Set((responses ?? []).map((r) => r.user_id));

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const nameOf = (uid: string) =>
      profiles?.find((p) => p.id === uid)?.display_name?.trim() || null;

    for (const uid of ids) {
      if (answered.has(uid)) continue;
      const other = ids.find((x) => x !== uid) ?? null;
      const outcome = await notifyUser({
        admin,
        userId: uid,
        instanceId: instance.id,
        connectionId: conn.id,
        kind: "daily_ready",
        themName: other ? nameOf(other) : null,
        questionText,
      });
      if (outcome === "sent") counts.sent += 1;
      else if (outcome === "failed") counts.failed += 1;
      else counts.skipped += 1;
    }
  }

  return NextResponse.json({ date, ...counts });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
