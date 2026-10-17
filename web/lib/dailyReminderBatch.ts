/**
 * Pure helpers for the daily-reminder cron so the route can batch reads
 * instead of N+1 querying members / responses / profiles per connection.
 */

export type ConnectionWindow = { id: string; timezone: string };

/** The hour (0–23) in a connection's time zone; UTC if the zone is bad. */
export function localHour(tz: string, now: Date): number {
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

export function filterConnectionsInSendWindow(
  connections: ConnectionWindow[],
  localHour: (tz: string, now: Date) => number,
  now: Date,
  hourFrom: number,
  hourTo: number,
): ConnectionWindow[] {
  return connections.filter((c) => {
    const hour = localHour(c.timezone, now);
    return hour >= hourFrom && hour <= hourTo;
  });
}

export type MemberRow = { connection_id: string; user_id: string };

/** Group joined members by connection_id. */
export function membersByConnection(
  members: MemberRow[] | null | undefined,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const m of members ?? []) {
    const list = map.get(m.connection_id) ?? [];
    list.push(m.user_id);
    map.set(m.connection_id, list);
  }
  return map;
}

export type ResponseRow = { instance_id: string; user_id: string };

/** Set of user ids who already answered, keyed by instance id. */
export function answeredByInstance(
  responses: ResponseRow[] | null | undefined,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of responses ?? []) {
    let set = map.get(r.instance_id);
    if (!set) {
      set = new Set();
      map.set(r.instance_id, set);
    }
    set.add(r.user_id);
  }
  return map;
}

export type ProfileRow = { id: string; display_name: string | null };

export function displayNameMap(
  profiles: ProfileRow[] | null | undefined,
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    map.set(p.id, p.display_name?.trim() || null);
  }
  return map;
}

/**
 * Partition connection ids into those that already have today's daily
 * instance and those that still need ensure_daily_prompt.
 */
export function partitionDailyInstances(
  connectionIds: string[],
  todayFor: Map<string, string>,
  existing: { id: string; connection_id: string; scheduled_for: string | null }[],
): {
  ready: Map<string, string>; // connection_id → instance_id
  missing: string[];
} {
  const ready = new Map<string, string>();
  const byConn = new Map<string, string>();
  for (const row of existing) {
    if (row.scheduled_for && row.scheduled_for === todayFor.get(row.connection_id)) {
      byConn.set(row.connection_id, row.id);
    }
  }
  const missing: string[] = [];
  for (const id of connectionIds) {
    const inst = byConn.get(id);
    if (inst) ready.set(id, inst);
    else missing.push(id);
  }
  return { ready, missing };
}
