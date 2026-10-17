import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCronBearer } from "@/lib/cronAuth";
import { emailConfigured } from "@/lib/email";
import { notifyUser } from "@/lib/notify";
import {
  displayNameMap,
  filterConnectionsInSendWindow,
  localHour,
  membersByConnection,
} from "@/lib/dailyReminderBatch";
import {
  pickTurnReminders,
  TURN_REMINDER_KINDS,
  TURN_REMINDER_MAX_HOURS,
} from "@/lib/turnReminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Still your turn": one follow-up when a shared set (first questions, a quiz
// or a challenge) has waited 36+ hours on one person. The first "your turn"
// fires at submit; this is the only other one, once per set per person
// (notification_log, kind turn_reminder), inside the connection's local
// 9am–8pm window, and only for people with the "your turn" switch on.
// Reads ids and timestamps only, never answer content.
const SEND_HOUR_FROM = 9;
const SEND_HOUR_TO = 20;
const MAX_INSTANCES = 5_000;


async function run(req: Request) {
  if (!authorizeCronBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ skipped: "notifications not configured" });
  }

  const admin = createAdminClient();
  const now = new Date();
  const counts = { candidates: 0, outside_window: 0, sent: 0, skipped: 0, failed: 0 };

  // Responses old enough to need a nudge but not stale: the window bounds
  // the scan to sets someone answered in the last week.
  const since = new Date(now.getTime() - TURN_REMINDER_MAX_HOURS * 3600_000).toISOString();
  const { data: recent } = await admin
    .from("prompt_responses")
    .select("instance_id")
    .gte("submitted_at", since)
    .limit(MAX_INSTANCES);
  const instanceIds = Array.from(new Set((recent ?? []).map((r) => r.instance_id)));
  if (instanceIds.length === 0) return NextResponse.json({ at: now.toISOString(), ...counts });

  const { data: instances } = await admin
    .from("prompt_instances")
    .select("id, connection_id, kind, status")
    .in("id", instanceIds)
    .eq("status", "open")
    .in("kind", [...TURN_REMINDER_KINDS]);
  if (!instances?.length) return NextResponse.json({ at: now.toISOString(), ...counts });

  const connectionIds = Array.from(new Set(instances.map((i) => i.connection_id)));
  const [{ data: conns }, { data: memberRows }, { data: responses }] = await Promise.all([
    admin
      .from("connections")
      .select("id, timezone, status")
      .in("id", connectionIds)
      .in("status", ["onboarding", "active"]),
    admin
      .from("connection_members")
      .select("connection_id, user_id")
      .in("connection_id", connectionIds)
      .not("joined_at", "is", null),
    admin
      .from("prompt_responses")
      .select("instance_id, user_id, submitted_at")
      .in("instance_id", instances.map((i) => i.id)),
  ]);

  const live = new Map((conns ?? []).map((c) => [c.id, c] as const));
  const picks = pickTurnReminders({
    instances: instances.filter((i) => live.has(i.connection_id)),
    membersByConnection: membersByConnection(memberRows),
    responses: responses ?? [],
    now,
  });
  counts.candidates = picks.length;

  const inWindow = new Set(
    filterConnectionsInSendWindow(
      Array.from(live.values()).map((c) => ({ id: c.id, timezone: c.timezone })),
      localHour,
      now,
      SEND_HOUR_FROM,
      SEND_HOUR_TO,
    ).map((c) => c.id),
  );

  const nameIds = Array.from(new Set(picks.map((p) => p.answeredById)));
  const { data: profileRows } = nameIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", nameIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const names = displayNameMap(profileRows);

  for (const pick of picks) {
    if (!inWindow.has(pick.connectionId)) {
      counts.outside_window += 1;
      continue;
    }
    const outcome = await notifyUser({
      admin,
      userId: pick.recipientId,
      instanceId: pick.instanceId,
      connectionId: pick.connectionId,
      kind: "turn_reminder",
      themName: names.get(pick.answeredById) ?? null,
    });
    if (outcome === "sent") counts.sent += 1;
    else if (outcome === "failed") counts.failed += 1;
    else counts.skipped += 1;
  }

  return NextResponse.json({ at: now.toISOString(), ...counts });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
