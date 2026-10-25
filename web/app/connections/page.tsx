import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";
import { dailyBadge, dailyState, firstSetBadge, todayIn, todayUtc } from "@/lib/dailyState";
import { fetchOthersHaveAnswered } from "@/lib/othersHaveAnswered";
import { PREMIUM_MONTHLY_DISPLAY } from "@/lib/pricing";
import type { ConnectionType } from "@/lib/database.types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, TYPE_ICON, TYPE_TINT } from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";

type ConnectionRow = {
  id: string;
  type: ConnectionType;
  status: string;
  them: string | null;
  badge: ReturnType<typeof dailyBadge>;
};

const BADGE_CLS: Record<NonNullable<ConnectionRow["badge"]>["tone"], string> = {
  action: "pill-action",
  quiet: "pill-quiet",
  done: "pill-done",
};

function ConnectionList({ items }: { items: ConnectionRow[] }) {
  return (
    <ul className="stagger mt-5 space-y-3">
      {items.map((c) => {
        const pending = c.status === "pending";
        return (
          <li key={c.id}>
            <Link
              href={`/connections/${c.id}`}
              className="card card-hover group flex items-center gap-4 !p-4"
            >
              {c.them ? (
                <Avatar name={c.them} size="lg" variant="them" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-brand-300 text-brand-400 dark:border-brand-700">
                  <Icon name={pending ? "send" : TYPE_ICON[c.type]} className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="truncate font-display text-xl text-ink">
                    {c.them ?? connectionLabel(c.type)}
                  </p>
                  {c.badge ? (
                    <span className={BADGE_CLS[c.badge.tone]}>{c.badge.label}</span>
                  ) : (
                    <span className={c.status === "active" ? "pill-brand" : "pill-quiet"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${TYPE_TINT[c.type]}`}>
                    <Icon name={TYPE_ICON[c.type]} className="h-2.5 w-2.5" strokeWidth={2.2} />
                  </span>
                  {c.them ? connectionLabel(c.type) : (STATUS_LABEL[c.status] ?? c.status)}
                </p>
              </div>
              <Icon
                name="chevron-right"
                className="hidden h-5 w-5 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-brand-600 sm:block"
              />
            </Link>
          </li>
        );
      })}
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

  const live = rows.filter((c) => c.status !== "archived");
  const yourTurn = live.filter((c) => c.badge?.tone === "action").length;

  return (
    <div className="page has-tabbar">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your people</p>
          <h1 className="mt-2 text-display-md">Your connections</h1>
          {live.length > 0 && (
            <p className="mt-2 text-sm text-ink-soft">
              {yourTurn > 0
                ? `${yourTurn} waiting on you.`
                : "Nothing waiting on you right now."}
            </p>
          )}
        </div>
        <Link href="/connections/new" className="btn-primary">
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
          New connection
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon="rings"
            title="Invite someone to start"
            body={
              <>
                Create a connection, share the link, and answer your first
                questions together. Sign-in is Google. Safety resources stay
                free; Premium ({PREMIUM_MONTHLY_DISPLAY}) is optional.
              </>
            }
          >
            <Link href="/connections/new" className="btn-primary btn-lg">
              Create and invite
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <ConnectionList items={live} />
          {rows.some((c) => c.status === "archived") && (
            <details className="mt-10">
              <summary className="cursor-pointer list-none text-sm font-medium text-ink-faint hover:text-ink [&::-webkit-details-marker]:hidden">
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
