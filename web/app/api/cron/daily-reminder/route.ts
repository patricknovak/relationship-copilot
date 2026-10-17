import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCronBearer } from "@/lib/cronAuth";
import { notificationsConfigured, notifyUser } from "@/lib/notify";
import { todayIn } from "@/lib/dailyState";
import {
  answeredByInstance,
  displayNameMap,
  filterConnectionsInSendWindow,
  membersByConnection,
  partitionDailyInstances,
} from "@/lib/dailyReminderBatch";
import type { PromptQuestion } from "@/lib/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily "today's question is ready" reminder. Opt-in per user (Account →
// Notifications), one email per person per connection per local day,
// enforced by notification_log. Called hourly by a scheduler with the
// CRON_SECRET bearer token (see docs/launch-checklist.md); each connection
// is emailed only inside its own local sending window, so the run is safe
// to repeat and zone-aware.
const PAGE = 500; // connections per query
const MAX_CONNECTIONS = 10_000; // hard cap per run, keeps the route bounded
const SEND_HOUR_FROM = 9; // local hour, inclusive
const SEND_HOUR_TO = 20; // local hour, inclusive

function localHour(tz: string, now: Date): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(now);
    const n = Number.parseInt(h, 10);
    return Number.isFinite(n) ? n % 24 : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

async function run(req: Request) {
  if (!authorizeCronBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!notificationsConfigured()) {
    return NextResponse.json({ skipped: "notifications not configured" });
  }

  const admin = createAdminClient();
  const now = new Date();
  const counts = {
    connections: 0,
    outside_window: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  // Page through active connections in id order so every one is visited.
  const connections: { id: string; timezone: string }[] = [];
  let cursor: string | null = null;
  while (connections.length < MAX_CONNECTIONS) {
    let q = admin
      .from("connections")
      .select("id, timezone")
      .eq("status", "active")
      .order("id", { ascending: true })
      .limit(PAGE);
    if (cursor) q = q.gt("id", cursor);
    const { data: page, error } = await q;
    if (error || !page || page.length === 0) break;
    connections.push(...page);
    cursor = page[page.length - 1].id;
    if (page.length < PAGE) break;
  }

  counts.connections = connections.length;
  const inWindow = filterConnectionsInSendWindow(
    connections,
    localHour,
    now,
    SEND_HOUR_FROM,
    SEND_HOUR_TO,
  );
  counts.outside_window = connections.length - inWindow.length;
  if (inWindow.length === 0) {
    return NextResponse.json({ at: now.toISOString(), ...counts });
  }

  const todayFor = new Map(
    inWindow.map((c) => [c.id, todayIn(c.timezone, now)] as const),
  );
  const windowIds = inWindow.map((c) => c.id);

  // Prefetch existing dailies for the three-day UTC window covering every
  // connection's local "today", then only call ensure_daily_prompt for gaps.
  const utcDates = Array.from(new Set(todayFor.values())).sort();
  const fromDate = utcDates[0];
  const { data: existingDailies } = await admin
    .from("prompt_instances")
    .select("id, connection_id, scheduled_for, status, questions")
    .in("connection_id", windowIds)
    .eq("kind", "daily")
    .gte("scheduled_for", fromDate);

  const { ready, missing } = partitionDailyInstances(
    windowIds,
    todayFor,
    existingDailies ?? [],
  );

  // Fill gaps with ensure_daily_prompt (still per missing connection — the
  // RPC is connection-scoped and idempotent).
  for (const connId of missing) {
    const date = todayFor.get(connId)!;
    const { data: instanceId } = await admin.rpc("ensure_daily_prompt", {
      p_conn: connId,
      p_date: date,
    });
    if (instanceId) ready.set(connId, instanceId);
  }

  const instanceIds = Array.from(new Set(ready.values()));
  if (instanceIds.length === 0) {
    return NextResponse.json({ at: now.toISOString(), ...counts });
  }

  // Batch-load instance details for any ensure_daily ids not in the prefetch.
  const known = new Map(
    (existingDailies ?? []).map((d) => [d.id, d] as const),
  );
  const needFetch = instanceIds.filter((id) => !known.has(id));
  if (needFetch.length) {
    const { data: fetched } = await admin
      .from("prompt_instances")
      .select("id, connection_id, scheduled_for, status, questions")
      .in("id", needFetch);
    for (const row of fetched ?? []) known.set(row.id, row);
  }

  // One members query + one responses query + one profiles query for the
  // whole window (was N+1 inside the per-connection loop).
  const { data: memberRows } = await admin
    .from("connection_members")
    .select("connection_id, user_id")
    .in("connection_id", windowIds)
    .not("joined_at", "is", null);
  const membersMap = membersByConnection(memberRows);

  const { data: responseRows } = await admin
    .from("prompt_responses")
    .select("instance_id, user_id")
    .in("instance_id", instanceIds);
  const answeredMap = answeredByInstance(responseRows);

  const allUserIds = Array.from(
    new Set(Array.from(membersMap.values()).flat()),
  );
  const { data: profileRows } = allUserIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", allUserIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const names = displayNameMap(profileRows);

  for (const conn of inWindow) {
    const instanceId = ready.get(conn.id);
    if (!instanceId) continue;
    const instance = known.get(instanceId);
    if (!instance || instance.status !== "open") continue;

    const qs = Array.isArray(instance.questions)
      ? (instance.questions as PromptQuestion[])
      : [];
    const questionText = qs[0]?.text ?? null;

    const ids = membersMap.get(conn.id) ?? [];
    if (ids.length < 2) continue;

    const answered = answeredMap.get(instance.id) ?? new Set<string>();

    for (const uid of ids) {
      if (answered.has(uid)) continue;
      const other = ids.find((x) => x !== uid) ?? null;
      const outcome = await notifyUser({
        admin,
        userId: uid,
        instanceId: instance.id,
        connectionId: conn.id,
        kind: "daily_ready",
        themName: other ? (names.get(other) ?? null) : null,
        questionText,
      });
      if (outcome === "sent") counts.sent += 1;
      else if (outcome === "failed") counts.failed += 1;
      else counts.skipped += 1;
    }
  }

  return NextResponse.json({ at: now.toISOString(), ...counts });
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
