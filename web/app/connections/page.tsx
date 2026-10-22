import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";
import { dailyBadge, dailyState, firstSetBadge, todayIn, todayUtc } from "@/lib/dailyState";
import { fetchOthersHaveAnswered } from "@/lib/othersHaveAnswered";
import { PREMIUM_MONTHLY_DISPLAY } from "@/lib/pricing";
import type { ConnectionType } from "@/lib/database.types";

type ConnectionRow = {
  id: string;
  type: ConnectionType;
  status: string;
  them: string | null;
  badge: ReturnType<typeof dailyBadge>;
};

const BADGE_CLS: Record<NonNullable<ConnectionRow["badge"]>["tone"], string> = {
  action:
    "bg-brand-700 text-white dark:bg-brand-500",
  quiet: "bg-paper-warm text-ink-soft",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

function ConnectionList({ items }: { items: ConnectionRow[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/connections/${c.id}`} className="card card-hover block">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-lg text-ink">
                  {c.them ?? connectionLabel(c.type)}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft/80">
                  {c.them ? connectionLabel(c.type) : STATUS_LABEL[c.status] ?? c.status}
                </p>
              </div>
              {c.badge ? (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_CLS[c.badge.tone]}`}
                >
                  {c.badge.label}
                </span>
              ) : (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    c.status === "active"
                      ? "bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200"
                      : "bg-paper-warm text-ink-soft"
                  }`}
                >
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for your person",
  onboarding: "First questions",
  active: "Active",
  archived: "Archived",
  blocked: "Blocked",
};

export default async function ConnectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS scopes this to the signed-in user's connections.
  const { data: connections } = await supabase
    .from("connections")
    .select("id, type, status, created_at, timezone")
    .order("created_at", { ascending: false });

  const ids = (connections ?? []).map((c) => c.id);

  // The other person in each connection, by display name only.
  const themByConnection = new Map<string, string | null>();
  // Members rows exist only once someone has joined (accept_invite).
  const partnerJoined = new Set<string>();
  if (ids.length && user) {
    const { data: members } = await supabase
      .from("connection_members")
      .select("connection_id, user_id")
      .in("connection_id", ids)
      .neq("user_id", user.id);
    for (const m of members ?? []) partnerJoined.add(m.connection_id);
    const otherIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
    const { data: profiles } = otherIds.length
      ? await supabase
          .from("partner_profiles")
          .select("id, display_name")
          .in("id", otherIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    for (const m of members ?? []) {
      const name = profiles?.find((p) => p.id === m.user_id)?.display_name;
      themByConnection.set(m.connection_id, name?.trim() || null);
    }
  }

  // Today's daily state per active connection, so the list says whose turn
  // it is. Reads go through RLS; the boolean RPC is the only way to learn the
  // other person has answered before you have.
  const badgeByConnection = new Map<string, ReturnType<typeof dailyBadge>>();
  const activeIds = (connections ?? [])
    .filter((c) => c.status === "active")
    .map((c) => c.id);
  if (activeIds.length && user) {
    // Each connection has its own local "today"; fetch a three-day window
    // and keep the instance matching that connection's date.
    const utc = todayUtc();
    const from = new Date(`${utc}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 1);
    const todayFor = new Map(
      (connections ?? []).map((c) => [c.id, todayIn(c.timezone)] as const),
    );
    const { data: dailiesWindow } = await supabase
      .from("prompt_instances")
      .select("id, connection_id, status, scheduled_for")
      .in("connection_id", activeIds)
      .eq("kind", "daily")
      .gte("scheduled_for", from.toISOString().slice(0, 10));
    const dailies = (dailiesWindow ?? []).filter(
      (d) => d.scheduled_for === todayFor.get(d.connection_id),
    );
    const dailyIds = (dailies ?? []).map((d) => d.id);
    const { data: mine } = dailyIds.length
      ? await supabase
          .from("prompt_responses")
          .select("instance_id")
          .in("instance_id", dailyIds)
          .eq("user_id", user.id)
      : { data: [] as { instance_id: string }[] };
    const answered = new Set((mine ?? []).map((r) => r.instance_id));
    // One batch RPC for every daily that still needs the boolean-only signal
    // (was N `others_have_answered` calls — one per connection).
    const needOthers = (dailies ?? [])
      .filter((d) => !answered.has(d.id) && d.status !== "revealed")
      .map((d) => d.id);
    const othersSet = await fetchOthersHaveAnswered(supabase, needOthers);
    for (const d of dailies ?? []) {
      const iAnswered = answered.has(d.id);
      const theyAnswered =
        d.status === "revealed" || othersSet.has(d.id);
      badgeByConnection.set(
        d.connection_id,
        dailyBadge(
          dailyState({
            hasInstance: true,
            status: d.status,
            iAnswered,
            theyAnswered,
          }),
        ),
      );
    }
  }

  // The first set (pending / onboarding): whose turn it is, including an
  // inviter who answered before their person joined. Same RLS reads and
  // boolean-only signal as the dailies above.
  const firstSetIds = (connections ?? [])
    .filter((c) => c.status === "pending" || c.status === "onboarding")
    .map((c) => c.id);
  if (firstSetIds.length && user) {
    const { data: firstSets } = await supabase
      .from("prompt_instances")
      .select("id, connection_id, status")
      .in("connection_id", firstSetIds)
      .eq("kind", "onboarding");
    const setIds = (firstSets ?? []).map((i) => i.id);
    const { data: mineFirst } = setIds.length
      ? await supabase
          .from("prompt_responses")
          .select("instance_id")
          .in("instance_id", setIds)
          .eq("user_id", user.id)
      : { data: [] as { instance_id: string }[] };
    const answeredFirst = new Set((mineFirst ?? []).map((r) => r.instance_id));
    const othersFirst = await fetchOthersHaveAnswered(
      supabase,
      (firstSets ?? []).filter((i) => !answeredFirst.has(i.id) && i.status !== "revealed").map((i) => i.id),
    );
    const byConn = new Map((firstSets ?? []).map((i) => [i.connection_id, i] as const));
    for (const connId of firstSetIds) {
      const inst = byConn.get(connId);
      const state = dailyState({
        hasInstance: !!inst,
        status: inst?.status,
        iAnswered: !!inst && answeredFirst.has(inst.id),
        theyAnswered: !!inst && (inst.status === "revealed" || othersFirst.has(inst.id)),
      });
      const badge = firstSetBadge(state, partnerJoined.has(connId));
      if (badge) badgeByConnection.set(connId, badge);
    }
  }

  const rows: ConnectionRow[] = (connections ?? []).map((c) => ({
    id: c.id,
    type: c.type,
    status: c.status,
    them: themByConnection.get(c.id) ?? null,
    badge: badgeByConnection.get(c.id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Your connections</h1>
        <Link href="/connections/new" className="btn-primary">
          + New connection
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-10 !rounded-3xl border-dashed !border-brand-200 p-10 text-center">
          <p className="font-display text-xl text-ink">
            Invite someone to start
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Create a connection, share the link, and answer your first questions
            together. Sign-in is Google. Safety resources stay free; Premium (
            {PREMIUM_MONTHLY_DISPLAY}) is optional.
          </p>
          <Link href="/connections/new" className="btn-primary mt-5">
            Create and invite
          </Link>
        </div>
      ) : (
        <>
          <ConnectionList items={rows.filter((c) => c.status !== "archived")} />
          {rows.some((c) => c.status === "archived") && (
            <details className="mt-8">
              <summary className="cursor-pointer text-sm text-ink-soft/80">
                Archived ({rows.filter((c) => c.status === "archived").length})
              </summary>
              <div className="mt-3 opacity-70">
                <ConnectionList
                  items={rows.filter((c) => c.status === "archived")}
                />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
