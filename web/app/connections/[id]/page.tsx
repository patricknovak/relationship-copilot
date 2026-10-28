import Link from "next/link";
import { signInVia } from "@/lib/signInCopy";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";
import { startOnboarding, ensureDaily, startElective } from "@/app/actions/prompts";
import { pickWeeklySuggestion } from "@/lib/suggestion";
import { leaveConnection, regenerateInvite, setInviteNote } from "@/app/actions/connections";
import { INVITE_NOTE_MAX } from "@/lib/inviteNote";
import { computeStreak } from "@/lib/streak";
import { ZODIAC_DISCLAIMER } from "@/lib/zodiac";
import InvitePanel from "@/components/InvitePanel";
import WeeklyDigest from "@/components/WeeklyDigest";
import LookingBack from "@/components/LookingBack";
import RevealWatcher from "@/components/RevealWatcher";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";
import NudgePerson from "@/components/NudgePerson";
import AddReminder from "@/components/AddReminder";
import { setDisplayName } from "@/app/actions/profile";
import { suggestedFirstName } from "@/lib/profileName";
import {
  ANSWER_FIRST,
  answerFirstBody,
  BOTH_JOINED,
  bothJoinedBody,
  EMPTY_STATE,
  WAITING_ON_THEM,
  WAITING_ON_YOU,
} from "@/lib/firstRevealCopy";
import type { PromptQuestion } from "@/lib/database.types";
import { ensureOnboardingInstance } from "@/lib/onboarding";
import { dailyCardCopy, dailyState, todayIn } from "@/lib/dailyState";
import TimezoneSync from "@/components/TimezoneSync";
import SharedGoals from "@/components/SharedGoals";
import { questionsInviteCopy } from "@/lib/questionsCta";
import { Avatar, DuoAvatars } from "@/components/ui/Avatar";
import { Icon, TYPE_ICON, TYPE_TINT } from "@/components/ui/Icon";
import { aiEnabled } from "@/lib/grok";
import { blueprintOffer, freeBlueprintState } from "@/lib/freeBlueprint";
import WhileYouWait from "@/components/WhileYouWait";
import InstallNudge from "@/components/InstallNudge";
import { vapidFromEnv } from "@/lib/webPush";

const NOTICES: Record<
  string,
  { tone: "info" | "error" | "success"; text: string }
> = {
  waiting: {
    tone: "info",
    text: "Once your person joins, you can start activities together.",
  },
  nopack: {
    tone: "error",
    text: "The question pack for this relationship type isn't ready yet — try again soon.",
  },
  nodaily: {
    tone: "info",
    text: "No new daily question is available right now — check back tomorrow.",
  },
  "digest-premium": {
    tone: "info",
    text: "Weekly digests are part of Premium.",
  },
  "digest-gap": {
    tone: "info",
    text: "This week's digest already exists — a new one unlocks next week.",
  },
  "digest-empty": {
    tone: "info",
    text: "Nothing to digest yet — answer a few daily questions together this week first.",
  },
  "digest-solo": {
    tone: "info",
    text: "Both people need to be in the connection before a digest can be written.",
  },
  "digest-ai": {
    tone: "error",
    text: "The AI couldn't finish the digest just now — nothing was lost, try again in a moment.",
  },
  newlink: {
    tone: "info",
    text: "Fresh invite link ready — the old one no longer works. Share the new one below.",
  },
  linkfailed: {
    tone: "error",
    text: "Couldn't create a new link just now — try again in a moment.",
  },
  named: {
    tone: "success",
    text: "Name saved. Your person will see that name next to your answers.",
  },
  "note-saved": { tone: "success", text: "Note added. It shows on the invite and in the message you share." },
  "note-cleared": { tone: "info", text: "Note removed from the invite." },
  "note-long": { tone: "error", text: `Keep the note under ${INVITE_NOTE_MAX} characters.` },
  "note-link": {
    tone: "error",
    text: "Links can't go in the note. The invite already carries the only link they need.",
  },
  "note-failed": { tone: "error", text: "Couldn't save the note just now. Try again in a moment." },
  "goal-empty": { tone: "info", text: "Write the goal first, then add it." },
  "goal-full": {
    tone: "info",
    text: "Twenty open goals is plenty — tick a few off before adding more.",
  },
  "goal-failed": {
    tone: "error",
    text: "Couldn't save that goal just now — try again in a moment.",
  },
};

export default async function ConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string; list?: string }>;
}) {
  const { id } = await params;
  const { notice, error, list: listRaw } = await searchParams;
  const listInviteCopy = questionsInviteCopy(listRaw);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conn } = await supabase
    .from("connections")
    .select("id, type, status, invite_code, invite_expires_at, created_by, timezone")
    .eq("id", id)
    .maybeSingle();
  if (!conn) notFound();

  // Reads that need only the connection row run together; the ones below
  // that depend on these (the other person's name, my response, today's
  // flags) follow. Same queries as before, same RLS, fewer round trips.
  const localToday = todayIn(conn.timezone);
  const streakFrom = new Date(`${localToday}T00:00:00Z`);
  streakFrom.setUTCDate(streakFrom.getUTCDate() - 400);
  const [
    { data: members },
    { data: me },
    { data: onboardingRow },
    { data: dailies },
    { data: dailyRow },
    { data: noteRow },
  ] = await Promise.all([
    supabase
      .from("connection_members")
      .select("user_id, role, joined_at")
      .eq("connection_id", id),
    // Used to personalize the outgoing invite message ("Sam invited you…")
    // and to nudge name-less users (email invitees who skipped onboarding).
    user
      ? supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("prompt_instances")
      .select("id, status, questions")
      .eq("connection_id", id)
      .eq("kind", "onboarding")
      .maybeSingle(),
    // Daily streak (gamification) from revealed daily instances. Only the
    // recent window matters — streaks longer than ~14 months aren't shown
    // as a bigger number in a way that needs the full history.
    supabase
      .from("prompt_instances")
      .select("scheduled_for")
      .eq("connection_id", id)
      .eq("kind", "daily")
      .eq("status", "revealed")
      .gte("scheduled_for", streakFrom.toISOString().slice(0, 10)),
    // Today's daily, if cron already created it (members only under RLS).
    // 0042: available from the day both people join, not only after the
    // first set is revealed.
    (conn.status === "active" || conn.status === "onboarding") && user
      ? supabase
          .from("prompt_instances")
          .select("id, status, questions")
          .eq("connection_id", id)
          .eq("kind", "daily")
          .eq("scheduled_for", localToday)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // The creator's personal note on a pending invite (RLS: creator only).
    user && conn.created_by === user.id && conn.status === "pending"
      ? supabase.from("invite_notes").select("note").eq("connection_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const joinedCount = (members ?? []).filter((m) => m.joined_at).length;
  const myName = me?.display_name?.trim() || null;
  // Today's question opens the day both people are in, so the first reveal
  // can be one answer each instead of the whole first set.
  const dailyOpen =
    joinedCount >= 2 && (conn.status === "active" || conn.status === "onboarding");

  // The other person's name for the heading and the daily card. Read through
  // the partner_profiles view, which exposes only display fields of people
  // you share a connection with.
  let themName: string | null = null;
  const otherId = (members ?? [])
    .map((m) => m.user_id)
    .find((uid) => uid !== user?.id);
  if (otherId) {
    const { data: them } = await supabase
      .from("partner_profiles")
      .select("display_name")
      .eq("id", otherId)
      .maybeSingle();
    themName = them?.display_name?.trim() || null;
  }

  let instance = onboardingRow;

  // Lazy backfill for pairs who joined before acceptInvite started creating
  // the instance. Idempotent; failure keeps the EMPTY_STATE Start answering
  // fallback. Does not change startOnboarding's both-joined gate or the reveal.
  if (joinedCount >= 2 && !instance) {
    try {
      const ensuredId = await ensureOnboardingInstance(supabase, id);
      if (ensuredId) {
        const { data: created } = await supabase
          .from("prompt_instances")
          .select("id, status, questions")
          .eq("id", ensuredId)
          .maybeSingle();
        instance = created;
      }
    } catch (err) {
      console.error("lazy ensureOnboardingInstance failed", id, err);
    }
  }

  const inviteNote = joinedCount < 2 ? (noteRow?.note ?? null) : null;

  const questionCount = Array.isArray(instance?.questions)
    ? (instance.questions as PromptQuestion[]).length
    : 0;

  let myResponse = null;
  let othersAnsweredOnboarding = false;
  if (instance && user) {
    const { data } = await supabase
      .from("prompt_responses")
      .select("id")
      .eq("instance_id", instance.id)
      .eq("user_id", user.id)
      .maybeSingle();
    myResponse = data;
    if (!myResponse && instance.status !== "revealed") {
      const { data: others } = await supabase.rpc("others_have_answered", {
        p_instance: instance.id,
      });
      othersAnsweredOnboarding = !!others;
    }
  }

  const streak = computeStreak(
    (dailies ?? []).map((d) => d.scheduled_for).filter((x): x is string => !!x),
    localToday,
  );

  // Today's question, inline. The instance is pre-created by cron for joined
  // connections; ensure_daily_prompt is the idempotent fallback (members
  // only). Both answer flags are read under RLS / via the boolean-only RPC, so
  // the card never sees the other person's words early.
  let today: {
    id: string;
    text: string;
    state: ReturnType<typeof dailyState>;
  } | null = null;
  if (dailyOpen && user) {
    const date = localToday;
    let daily = dailyRow;
    if (!daily) {
      const { data: ensuredId } = await supabase.rpc("ensure_daily_prompt", {
        p_conn: id,
        p_date: date,
      });
      if (ensuredId) {
        const { data: created } = await supabase
          .from("prompt_instances")
          .select("id, status, questions")
          .eq("id", ensuredId)
          .maybeSingle();
        daily = created;
      }
    }
    if (daily) {
      const { data: mine } = await supabase
        .from("prompt_responses")
        .select("id")
        .eq("instance_id", daily.id)
        .eq("user_id", user.id)
        .maybeSingle();
      let theyAnswered = daily.status === "revealed";
      if (!mine && !theyAnswered) {
        const { data: others } = await supabase.rpc("others_have_answered", {
          p_instance: daily.id,
        });
        theyAnswered = !!others;
      }
      const qs = Array.isArray(daily.questions)
        ? (daily.questions as PromptQuestion[])
        : [];
      today = {
        id: daily.id,
        text: qs[0]?.text ?? "",
        state: dailyState({
          hasInstance: true,
          status: daily.status,
          iAnswered: !!mine,
          theyAnswered,
        }),
      };
    }
  }

  // One suggested quiz or challenge the pair hasn't started, rotating
  // weekly so the hub keeps offering something new without nagging.
  let suggestion: { id: string; kind: string; title: string; description: string | null } | null = null;
  if (conn.status === "active" && joinedCount >= 2) {
    const [{ data: electives }, { data: started }] = await Promise.all([
      supabase
        .from("prompt_templates")
        .select("id, kind, title, description")
        .in("kind", ["quiz", "challenge"])
        .eq("active", true)
        .or(`relationship_type.eq.${conn.type},relationship_type.is.null`)
        .order("id"),
      supabase
        .from("prompt_instances")
        .select("template_id")
        .eq("connection_id", id)
        .in("kind", ["quiz", "challenge"]),
    ]);
    const done = new Set((started ?? []).map((s) => s.template_id).filter(Boolean));
    suggestion = pickWeeklySuggestion(
      (electives ?? []).map((t) => ({ ...t, title: t.title ?? "", kind: t.kind })),
      done,
      localToday,
    );
  }

  // Zodiac compatibility (entertainment only). Computed server-side so
  // partner birth dates are never readable through profiles RLS.
  let compat: { level: string; blurb: string; signs: string[] } | null = null;
  if (joinedCount >= 2) {
    const { data } = await supabase.rpc("connection_zodiac_compat", {
      p_conn: id,
    });
    if (data && typeof data === "object" && "blurb" in (data as object)) {
      compat = data as { level: string; blurb: string; signs: string[] };
    }
  }

  const begin = startOnboarding.bind(null, id);
  const leave = leaveConnection.bind(null, id);
  const isParentTeen = conn.type === "parent_child";
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // Invites expire (14 days, set in the DB). An expired code still sits on the
  // row, so treat it as absent and offer a fresh link instead of a dead one.
  const inviteExpired =
    !!conn.invite_expires_at && new Date(conn.invite_expires_at) <= new Date();
  const inviteUrl =
    conn.invite_code && !inviteExpired ? `${base}/invite/${conn.invite_code}` : null;
  const inviteExpiresOn = conn.invite_expires_at
    ? new Date(conn.invite_expires_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
      })
    : null;
  const newLink = regenerateInvite.bind(null, id);
  const saveNote = setInviteNote.bind(null, id);

  // The Blueprint card says when this connection's first one is free.
  let blueprintCardOffer: ReturnType<typeof blueprintOffer> | null = null;
  if (conn.status === "active" && user) {
    const [{ data: hubPremium }, freeState] = await Promise.all([
      supabase.rpc("connection_has_premium", { p_conn: id }),
      freeBlueprintState(supabase, id),
    ]);
    blueprintCardOffer = blueprintOffer({
      isPremium: !!hubPremium,
      aiOn: aiEnabled(),
      revealed: instance?.status === "revealed",
      free: freeState,
    });
  }

  const todayCopy = today ? dailyCardCopy(today.state, themName) : null;
  // After the pair's first reveal of anything, phones get one install card.
  const hasRevealed =
    instance?.status === "revealed" || streak > 0 || today?.state === "revealed";
  const todayIsAction = today?.state === "your_turn" || today?.state === "answer";

  const todaySection = dailyOpen ? (
    <>
      {/* Daily question, shown inline with where you both are on it */}
      {today && todayCopy && (
        <section
          id="today"
          className={`mt-6 scroll-mt-24 ${todayIsAction ? "card-hero" : "card"}`}
        >
          {today.state !== "revealed" && <RevealWatcher instanceId={today.id} />}
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Today&apos;s question</p>
            {today.state === "revealed" ? (
              <span className="pill-done">Revealed</span>
            ) : today.state === "waiting" ? (
              <span className="pill-quiet">Waiting on {themName ?? "them"}</span>
            ) : today.state === "your_turn" ? (
              <span className="pill-action">Your turn</span>
            ) : null}
          </div>
          {today.text && (
            <p className="mt-3 font-display text-2xl leading-snug text-ink">
              &ldquo;{today.text}&rdquo;
            </p>
          )}
          <h2 className="mt-3 text-base font-sans font-semibold tracking-normal">{todayCopy.headline}</h2>
          <p className="mt-1 text-sm text-ink-soft">{todayCopy.body}</p>
          {conn.status === "onboarding" && today.state !== "revealed" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              One question, one reveal. Your first set stays open alongside it.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/connections/${id}/prompts/${today.id}`}
              className={
                today.state === "waiting" || today.state === "revealed"
                  ? "btn-secondary btn-sm"
                  : "btn-primary"
              }
            >
              {todayCopy.cta}
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
            {today.state === "waiting" && (
              <NudgePerson
                connectionUrl={`${base}/connections/${id}`}
                inviterName={myName}
                variant="finish"
              />
            )}
          </div>
        </section>
      )}
      {!today && (
        <section className="card mt-6">
          <p className="eyebrow">Today&apos;s question</p>
          <h2 className="mt-1 text-lg">A fresh prompt, every day</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Keep learning about each other, one question at a time.
          </p>
          <form action={ensureDaily.bind(null, id)} className="mt-3">
            <PendingButton pendingLabel="Opening…">
              Open today&apos;s question
            </PendingButton>
          </form>
        </section>
      )}
    </>
  ) : null;

  return (
    <div className="page has-tabbar">
      <Link href="/connections" className="back-link">
        <Icon name="arrow-left" className="h-4 w-4" />
        All connections
      </Link>
      {conn.timezone === "UTC" && conn.status !== "archived" && (
        <TimezoneSync connectionId={id} />
      )}

      {/* Hero header: the two of you, the kind of relationship, the streak. */}
      <header className="mt-4 flex items-center gap-4">
        {joinedCount >= 2 ? (
          <DuoAvatars you={myName ?? "You"} them={themName ?? "?"} size="lg" />
        ) : (
          <span className="inline-flex items-center">
            <Avatar name={myName ?? "You"} size="lg" variant="you" />
            <span className="-ml-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-brand-300 bg-surface text-brand-400 ring-2 ring-surface dark:border-brand-700">
              <Icon name="plus" className="h-5 w-5" />
            </span>
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${TYPE_TINT[conn.type]}`}>
              <Icon name={TYPE_ICON[conn.type]} className="h-2.5 w-2.5" strokeWidth={2.2} />
            </span>
            {connectionLabel(conn.type)}
          </p>
          <h1 className="mt-1 truncate text-display-md">
            {themName ?? (joinedCount >= 2 ? "Your person" : connectionLabel(conn.type))}
          </h1>
          {streak > 0 && (
            <p className="pill-warm mt-2">
              <Icon name="flame" className="h-3.5 w-3.5" />
              {streak}-day streak
            </p>
          )}
        </div>
      </header>

      {(notice || error) && (
        <NoticeBanner
          tone={error ? "error" : (NOTICES[notice ?? ""]?.tone ?? "info")}
          message={
            error === "name"
              ? "Please enter a name first."
              : (NOTICES[notice ?? ""]?.text ?? null)
          }
        />
      )}

      {/* Partner left or account deleted — connection stays readable but quiet. */}
      {conn.status === "archived" && (
        <section className="card mt-6">
          <h2 className="text-lg">This connection is archived</h2>
          <p className="mt-1 text-sm text-ink-soft">
            The other person left or deleted their account. Nothing new can be
            started here.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link href="/connections" className="btn-secondary btn-sm">
              All connections
            </Link>
            <Link href="/connections/new" className="btn-primary btn-sm">
              Invite someone new
            </Link>
          </div>
        </section>
      )}

      {/* Invitees who signed in straight from an email have no name yet —
          their partner would see them as "Them". One field fixes it. */}
      {user && !myName && conn.status !== "archived" && (
        <section className="card-tint mt-6">
          <h2 className="text-lg text-brand-800 dark:text-brand-200">
            What should we call you?
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Your person sees this name next to your answers.
          </p>
          <form action={setDisplayName} className="mt-3 flex gap-2">
            <input type="hidden" name="next" value={`/connections/${id}`} />
            <input
              name="display_name"
              required
              pattern=".*\S.*"
              maxLength={80}
              placeholder="Your name"
              aria-label="Your name"
              defaultValue={suggestedFirstName(user.user_metadata)}
              className="input flex-1"
            />
            <PendingButton className="btn-primary shrink-0" pendingLabel="Saving…">
              Save
            </PendingButton>
          </form>
        </section>
      )}

      {/* Parent & teen: trust-first, teen-revocable. Not surveillance. */}
      {isParentTeen && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <Icon name="shield" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">A space for connection, not monitoring.</p>
            <p className="mt-1">
              Both people choose to be here and can leave anytime. Answers follow
              the same private-until-you-both-share rule as everywhere else. For
              children under 13, verifiable parental consent is required and isn&apos;t
              yet supported here.
            </p>
          </div>
        </div>
      )}

      {/* Waiting for the other person to accept */}
      {inviteUrl && joinedCount < 2 && conn.status !== "archived" && (
        <section id="invite" className="card-hero mt-6 scroll-mt-24">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand-glow">
              <Icon name="send" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl">Waiting for your person</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {listInviteCopy
                  ? listInviteCopy
                  : `Share the invite link in one tap. They sign in with ${signInVia()}, join, and answer — then you reveal together. Nothing is visible early.`}
              </p>
              {listInviteCopy ? (
                <p className="mt-1 text-sm text-ink-soft">
                  Share the invite link in one tap. They sign in with {signInVia()},
                  join, and answer — then you reveal together. Nothing is visible early.
                </p>
              ) : null}
            </div>
          </div>
          <InvitePanel
            connectionId={id}
            url={inviteUrl}
            inviterName={myName}
            note={inviteNote}
            inviterAnswered={!!myResponse}
          />
          {user && conn.created_by === user.id && (
            <details className="mt-4 rounded-2xl border border-surface-line bg-surface/70 p-3.5 dark:bg-surface-raised/60" open={!!inviteNote}>
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-brand-800 dark:text-brand-200 [&::-webkit-details-marker]:hidden">
                <Icon name="chat" className="h-4 w-4" />
                {inviteNote ? "Your note" : "Add a personal note (optional)"}
              </summary>
              <form action={saveNote} className="mt-3 space-y-2">
                <textarea
                  name="note"
                  rows={2}
                  maxLength={INVITE_NOTE_MAX}
                  defaultValue={inviteNote ?? ""}
                  placeholder="Why you want to do this with them, in a line or two."
                  className="input min-h-16 text-sm"
                />
                <div className="flex items-center gap-3">
                  <PendingButton
                    className="btn-secondary btn-sm shrink-0 whitespace-nowrap"
                    pendingLabel="Saving…"
                  >
                    Save note
                  </PendingButton>
                  <span className="text-xs text-ink-faint">
                    They see it on the invite page. Clear it to remove it.
                  </span>
                </div>
              </form>
            </details>
          )}
          <form action={newLink} className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
            {inviteExpiresOn && (
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" className="h-3.5 w-3.5" />
                This link works until {inviteExpiresOn}.
              </span>
            )}
            <PendingButton
              className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-[3px] hover:decoration-brand-600 dark:text-brand-300"
              pendingLabel="Creating…"
            >
              Get a new link
            </PendingButton>
          </form>
        </section>
      )}

      {/* Invite expired (or never issued) and still waiting on the other person */}
      {!inviteUrl && joinedCount < 2 && conn.status !== "archived" && (
        <section id="invite" className="mt-6 scroll-mt-24 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-soft dark:border-amber-900/50 dark:bg-amber-950/30">
          <h2 className="text-lg text-amber-900 dark:text-amber-200">
            Your invite link has expired
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Invite links work for 14 days. Nothing else changes — create a
            fresh one and send it over.
          </p>
          <form action={newLink} className="mt-3">
            <PendingButton pendingLabel="Creating…">Get a new link</PendingButton>
          </form>
        </section>
      )}

      {/* Answer-first: the inviter can answer the first set before their
          person joins. A solo answer can never reveal (maybe_reveal_instance
          needs two joined members), so this only shortens their path. */}
      {joinedCount < 2 && conn.status !== "archived" && user && (
        <section className="card mt-6">
          {myResponse ? (
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                <Icon name="check" className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h2 className="text-lg">{ANSWER_FIRST.answeredHeadline}</h2>
                <p className="mt-1 text-sm text-ink-soft">{ANSWER_FIRST.answeredBody}</p>
                <Link
                  href={`/connections/${id}/onboarding`}
                  className="btn-secondary btn-sm mt-3 inline-flex"
                >
                  <Icon name="lock" className="h-3.5 w-3.5" />
                  {ANSWER_FIRST.reviewCta}
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <Icon name="eye-off" className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg">{ANSWER_FIRST.headline}</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {answerFirstBody(questionCount)}
                </p>
                <form action={begin} className="mt-3">
                  <PendingButton className="btn-secondary" pendingLabel="Opening…">
                    {ANSWER_FIRST.primaryCta}
                  </PendingButton>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* While the first set is open, today's single question comes first:
          it is the quickest way to a first reveal. */}
      {conn.status === "onboarding" && todaySection}

      {/* The inviter has answered and the link is out: give the wait something. */}
      {joinedCount < 2 && inviteUrl && myResponse && conn.status !== "archived" && (
        <WhileYouWait type={conn.type} />
      )}

      {/* Both joined — first shared set / mutual-reveal activation */}
      {joinedCount >= 2 && conn.status !== "archived" && (
        <section className={`mt-6 ${instance && instance.status !== "revealed" ? "card-hero" : "card"}`}>
          {!instance ? (
            <>
              {/* Fallback if ensureOnboardingInstance failed at join time */}
              <h2 className="text-lg">{EMPTY_STATE.headline}</h2>
              <p className="mt-1 text-sm text-ink-soft">{EMPTY_STATE.body}</p>
              <p className="mt-2 text-xs text-ink-faint">{EMPTY_STATE.trustLine}</p>
              <form action={begin} className="mt-3">
                <PendingButton pendingLabel="Setting up…">
                  {EMPTY_STATE.primaryCta}
                </PendingButton>
              </form>
            </>
          ) : instance.status === "revealed" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                  <Icon name="sparkles" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg">You revealed together.</h2>
                  <p className="mt-0.5 text-sm text-ink-soft">Your first questions, side by side.</p>
                </div>
              </div>
              <Link
                href={`/connections/${id}/onboarding`}
                className="btn-secondary btn-sm self-start sm:self-auto"
              >
                See answers
                <Icon name="arrow-right" className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : myResponse ? (
            <>
              {instance && <RevealWatcher instanceId={instance.id} />}
              <p className="eyebrow">Your first questions</p>
              <h2 className="mt-1 text-xl">{WAITING_ON_THEM.headline}</h2>
              <p className="mt-1 text-sm text-ink-soft">{WAITING_ON_THEM.body}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <NudgePerson
                  connectionUrl={`${base}/connections/${id}`}
                  inviterName={myName}
                  variant="finish"
                />
                <Link
                  href={`/connections/${id}/onboarding`}
                  className="btn-secondary btn-sm"
                >
                  {WAITING_ON_THEM.secondaryCta}
                </Link>
              </div>
              <p className="mt-3 text-xs text-ink-faint">{WAITING_ON_THEM.helper}</p>
            </>
          ) : othersAnsweredOnboarding ? (
            <>
              {instance && <RevealWatcher instanceId={instance.id} />}
              <p className="eyebrow">Your first questions</p>
              <h2 className="mt-1 text-xl">{WAITING_ON_YOU.headline}</h2>
              <p className="mt-1 text-sm text-ink-soft">{WAITING_ON_YOU.body}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                <Icon name="lock" className="h-3.5 w-3.5" />
                {WAITING_ON_YOU.trustLine}
              </p>
              <Link
                href={`/connections/${id}/onboarding`}
                className="btn-primary mt-4 inline-flex"
              >
                {WAITING_ON_YOU.primaryCta}
                <Icon name="arrow-right" className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              <p className="eyebrow">Your first questions</p>
              <h2 className="mt-1 text-xl">{BOTH_JOINED.headline}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {bothJoinedBody(questionCount)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href={`/connections/${id}/onboarding`}
                  className="inline-flex btn-primary"
                >
                  {BOTH_JOINED.primaryCta}
                  <Icon name="arrow-right" className="h-4 w-4" />
                </Link>
                <NudgePerson
                  connectionUrl={`${base}/connections/${id}`}
                  inviterName={myName}
                  variant="start"
                />
              </div>
              <div className="mt-3">
                <AddReminder connectionUrl={`${base}/connections/${id}`} />
              </div>
            </>
          )}
        </section>
      )}

      {conn.status === "active" && todaySection}

      {hasRevealed && conn.status !== "archived" && (
        <InstallNudge pushAvailable={!!vapidFromEnv()} />
      )}

      {/* Secondary tools: a two-up grid on wider screens. */}
      {conn.status === "active" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Quizzes & challenges */}
          <section className="card flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200">
                <Icon name="grid" className="h-[18px] w-[18px]" />
              </span>
              <h2 className="text-lg">Quizzes &amp; challenges</h2>
            </div>
            {suggestion ? (
              <div className="mt-3 flex-1 rounded-2xl border border-surface-line bg-paper-warm/60 p-4 dark:bg-surface-raised/60">
                <p className="eyebrow">
                  This week&apos;s {suggestion.kind === "quiz" ? "quiz" : "challenge"}
                </p>
                <p className="mt-1 font-display text-lg leading-snug text-ink">
                  {suggestion.title}
                </p>
                {suggestion.description && (
                  <p className="mt-1 text-sm text-ink-soft">{suggestion.description}</p>
                )}
                <form action={startElective.bind(null, id, suggestion.id)} className="mt-3">
                  <PendingButton className="btn-secondary btn-sm" pendingLabel="Starting…">
                    Start together
                  </PendingButton>
                </form>
              </div>
            ) : (
              <p className="mt-2 flex-1 text-sm text-ink-soft">
                Playful activities and reflections to do together.
              </p>
            )}
            <Link
              href={`/connections/${id}/explore`}
              className="link mt-3 inline-flex items-center gap-1 text-sm"
            >
              Explore all activities
              <Icon name="arrow-right" className="h-3.5 w-3.5" />
            </Link>
          </section>

          {/* Relationship Blueprint (AI; premium) */}
          <section className="card flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
                <Icon name="wand" className="h-[18px] w-[18px]" />
              </span>
              <h2 className="text-lg">Relationship Blueprint</h2>
            </div>
            <p className="mt-2 flex-1 text-sm text-ink-soft">
              An AI reflection on your strengths, shared goals, and areas to
              nurture.
              {(blueprintCardOffer === "free" || blueprintCardOffer === "free-later") &&
                " Your first one is on us."}
              {blueprintCardOffer === "ai-off" && " Switching on soon."}
            </p>
            <Link
              href={`/connections/${id}/blueprint`}
              className="link mt-3 inline-flex items-center gap-1 text-sm"
            >
              View Blueprint
              <Icon name="arrow-right" className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>
      )}

      {/* Shared goals — both-edit, visible immediately */}
      {conn.status === "active" && (
        <SharedGoals connectionId={id} themName={themName} />
      )}

      {/* Looking back — free retrospectives once there's history */}
      {conn.status === "active" && <LookingBack connectionId={id} />}

      {conn.status === "active" && (
        <Link
          href={`/connections/${id}/history`}
          className="card card-hover mt-6 flex items-center gap-3 !p-4"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-warm text-ink-soft">
            <Icon name="history" className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg text-ink">Everything you&apos;ve revealed</span>
            <span className="block text-sm text-ink-soft">Every reveal so far, newest first.</span>
          </span>
          <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-ink-faint" />
        </Link>
      )}

      {/* Weekly digest (AI; premium generates, both can read) */}
      {conn.status === "active" && <WeeklyDigest connectionId={id} />}

      {/* Zodiac compatibility — just for fun */}
      {conn.status === "active" && compat && (
        <section className="card-warm mt-6">
          <h2 className="flex items-center gap-2 text-lg text-accent-800 dark:text-accent-200">
            <Icon name="star" className="h-4 w-4" />
            Star match
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{compat.blurb}</p>
          <p className="mt-2 text-xs text-ink-faint">{ZODIAC_DISCLAIMER}</p>
        </section>
      )}

      {/* Leave — anyone can step away (teen-revocable). One extra tap so a
          stray click can't archive a shared space. */}
      {conn.status !== "archived" && (
        <details className="hairline mt-12 pt-6">
          <summary className="cursor-pointer list-none text-sm font-medium text-ink-faint hover:text-rose-600 [&::-webkit-details-marker]:hidden">
            Leave this connection
          </summary>
          <div className="mt-3 rounded-2xl border border-rose-200 p-4 dark:border-rose-900/50">
            <p className="text-sm text-ink-soft">
              This archives the connection for both of you. Nothing new can be
              started here afterwards, you each keep what you wrote, and the
              other person isn&apos;t notified. You can always start a new one.
            </p>
            <form action={leave} className="mt-3">
              <PendingButton
                className="btn-danger btn-sm"
                pendingLabel="Leaving…"
              >
                Yes, leave this connection
              </PendingButton>
            </form>
          </div>
        </details>
      )}
    </div>
  );
}
