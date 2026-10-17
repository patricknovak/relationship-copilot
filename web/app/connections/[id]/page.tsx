import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";
import { startOnboarding, ensureDaily, startElective } from "@/app/actions/prompts";
import { pickWeeklySuggestion } from "@/lib/suggestion";
import { leaveConnection, regenerateInvite } from "@/app/actions/connections";
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
import {
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

const NOTICES: Record<
  string,
  { tone: "info" | "error" | "success"; text: string }
> = {
  waiting: {
    tone: "info",
    text: "Once your person joins, your first questions unlock for you both.",
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
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const { notice, error } = await searchParams;
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

  const { data: members } = await supabase
    .from("connection_members")
    .select("user_id, role, joined_at")
    .eq("connection_id", id);
  const joinedCount = (members ?? []).filter((m) => m.joined_at).length;

  // Used to personalize the outgoing invite message ("Sam invited you…") and
  // to nudge name-less users (e.g. email invitees who skipped onboarding).
  let myName: string | null = null;
  if (user) {
    const { data: me } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    myName = me?.display_name?.trim() || null;
  }

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

  let { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, status, questions")
    .eq("connection_id", id)
    .eq("kind", "onboarding")
    .maybeSingle();

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

  // Daily streak (gamification) from revealed daily instances. Only the
  // recent window matters — streaks longer than ~14 months aren't shown as a
  // bigger number in a way that needs the full history.
  let streak = 0;
  {
    const today = todayIn(conn.timezone);
    const from = new Date(`${today}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 400);
    const { data: dailies } = await supabase
      .from("prompt_instances")
      .select("scheduled_for")
      .eq("connection_id", id)
      .eq("kind", "daily")
      .eq("status", "revealed")
      .gte("scheduled_for", from.toISOString().slice(0, 10));
    const dates = (dailies ?? [])
      .map((d) => d.scheduled_for)
      .filter((x): x is string => !!x);
    streak = computeStreak(dates, today);
  }

  // Today's question, inline. The instance is pre-created by cron for active
  // connections; ensure_daily_prompt is the idempotent fallback (members
  // only). Both answer flags are read under RLS / via the boolean-only RPC, so
  // the card never sees the other person's words early.
  let today: {
    id: string;
    text: string;
    state: ReturnType<typeof dailyState>;
  } | null = null;
  if (conn.status === "active" && user) {
    const date = todayIn(conn.timezone);
    let { data: daily } = await supabase
      .from("prompt_instances")
      .select("id, status, questions")
      .eq("connection_id", id)
      .eq("kind", "daily")
      .eq("scheduled_for", date)
      .maybeSingle();
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
      todayIn(conn.timezone),
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/connections" className="text-sm text-ink-soft/80 hover:text-ink-soft">
        ← All connections
      </Link>
      {conn.timezone === "UTC" && conn.status !== "archived" && (
        <TimezoneSync connectionId={id} />
      )}
      <p className="eyebrow mt-3">{connectionLabel(conn.type)}</p>
      <h1 className="mt-1 text-3xl">
        {themName ?? (joinedCount >= 2 ? "Your person" : connectionLabel(conn.type))}
      </h1>
      {streak > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 dark:bg-amber-900/30 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-200">
          🔥 {streak}-day streak
        </p>
      )}

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
            <Link href="/connections" className="btn-secondary !px-4 !py-2 text-sm">
              All connections
            </Link>
            <Link href="/connections/new" className="btn-primary !px-4 !py-2 text-sm">
              Invite someone new
            </Link>
          </div>
        </section>
      )}

      {/* Invitees who signed in straight from an email have no name yet —
          their partner would see them as "Them". One field fixes it. */}
      {user && !myName && conn.status !== "archived" && (
        <section className="card mt-6 !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:bg-brand-900/20 dark:!bg-brand-900/20">
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
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">A space for connection, not monitoring.</p>
          <p className="mt-1">
            Both people choose to be here and can leave anytime. Answers follow
            the same private-until-you-both-share rule as everywhere else. For
            children under 13, verifiable parental consent is required and isn&apos;t
            yet supported here.
          </p>
        </div>
      )}

      {/* Waiting for the other person to accept */}
      {inviteUrl && joinedCount < 2 && conn.status !== "archived" && (
        <section className="card mt-6 !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:bg-brand-900/20 dark:!bg-brand-900/20">
          <h2 className="text-lg text-brand-800 dark:text-brand-200">Invite your person</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Email it, text it, or share the link — once they join, you can both
            start your first questions.
          </p>
          <InvitePanel
            connectionId={id}
            url={inviteUrl}
            inviterName={myName}
          />
          <form action={newLink} className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft/80">
            {inviteExpiresOn && <span>This link works until {inviteExpiresOn}.</span>}
            <PendingButton
              className="underline hover:text-ink-soft"
              pendingLabel="Creating…"
            >
              Get a new link
            </PendingButton>
          </form>
        </section>
      )}

      {/* Invite expired (or never issued) and still waiting on the other person */}
      {!inviteUrl && joinedCount < 2 && conn.status !== "archived" && (
        <section className="card mt-6 !border-amber-200 dark:!border-amber-900/50 !bg-amber-50/60 dark:!bg-amber-950/30">
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

      {/* Both joined — first shared set / mutual-reveal activation */}
      {joinedCount >= 2 && conn.status !== "archived" && (
        <section className="card mt-6">
          {!instance ? (
            <>
              {/* Fallback if ensureOnboardingInstance failed at join time */}
              <h2 className="text-lg">{EMPTY_STATE.headline}</h2>
              <p className="mt-1 text-sm text-ink-soft">{EMPTY_STATE.body}</p>
              <p className="mt-2 text-xs text-ink-soft/80">{EMPTY_STATE.trustLine}</p>
              <form action={begin} className="mt-3">
                <PendingButton pendingLabel="Setting up…">
                  {EMPTY_STATE.primaryCta}
                </PendingButton>
              </form>
            </>
          ) : instance.status === "revealed" ? (
            <>
              <h2 className="text-lg">You revealed together.</h2>
              <p className="mt-1 text-sm">
                <Link
                  href={`/connections/${id}/onboarding`}
                  className="text-brand-700 underline dark:text-brand-300"
                >
                  See your answers side by side →
                </Link>
              </p>
            </>
          ) : myResponse ? (
            <>
              {instance && <RevealWatcher instanceId={instance.id} />}
              <h2 className="text-lg">{WAITING_ON_THEM.headline}</h2>
              <p className="mt-1 text-sm text-ink-soft">{WAITING_ON_THEM.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <NudgePerson
                  connectionUrl={`${base}/connections/${id}`}
                  inviterName={myName}
                  variant="finish"
                />
                <Link
                  href={`/connections/${id}/onboarding`}
                  className="btn-secondary !px-4 !py-2 text-sm"
                >
                  {WAITING_ON_THEM.secondaryCta}
                </Link>
              </div>
              <p className="mt-2 text-xs text-ink-soft/80">{WAITING_ON_THEM.helper}</p>
            </>
          ) : othersAnsweredOnboarding ? (
            <>
              {instance && <RevealWatcher instanceId={instance.id} />}
              <h2 className="text-lg">{WAITING_ON_YOU.headline}</h2>
              <p className="mt-1 text-sm text-ink-soft">{WAITING_ON_YOU.body}</p>
              <p className="mt-2 text-xs text-ink-soft/80">{WAITING_ON_YOU.trustLine}</p>
              <Link
                href={`/connections/${id}/onboarding`}
                className="mt-3 inline-flex btn-primary"
              >
                {WAITING_ON_YOU.primaryCta}
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-lg">{BOTH_JOINED.headline}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {bothJoinedBody(questionCount)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={`/connections/${id}/onboarding`}
                  className="inline-flex btn-primary"
                >
                  {BOTH_JOINED.primaryCta}
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

      {/* Daily question, shown inline with where you both are on it */}
      {conn.status === "active" && today && (
        <section
          id="today"
          className={`card mt-6 scroll-mt-24 ${
            today.state === "your_turn" || today.state === "answer"
              ? "!border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:!bg-brand-900/20"
              : ""
          }`}
        >
          {today.state !== "revealed" && <RevealWatcher instanceId={today.id} />}
          <p className="eyebrow">Today&apos;s question</p>
          <h2 className="mt-1 text-lg">{dailyCardCopy(today.state, themName).headline}</h2>
          {today.text && (
            <p className="mt-2 font-display text-xl leading-snug text-ink">
              &ldquo;{today.text}&rdquo;
            </p>
          )}
          <p className="mt-2 text-sm text-ink-soft">
            {dailyCardCopy(today.state, themName).body}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href={`/connections/${id}/prompts/${today.id}`}
              className={
                today.state === "waiting" || today.state === "revealed"
                  ? "btn-secondary !px-4 !py-2 text-sm"
                  : "btn-primary"
              }
            >
              {dailyCardCopy(today.state, themName).cta}
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
      {conn.status === "active" && !today && (
        <section className="card mt-6">
          <h2 className="text-lg">Today&apos;s question</h2>
          <p className="mt-1 text-sm text-ink-soft">
            A fresh prompt each day to keep learning about each other.
          </p>
          <form action={ensureDaily.bind(null, id)} className="mt-3">
            <PendingButton pendingLabel="Opening…">
              Open today&apos;s question
            </PendingButton>
          </form>
        </section>
      )}

      {/* Quizzes & challenges */}
      {conn.status === "active" && (
        <section className="card mt-6">
          <h2 className="text-lg">Quizzes &amp; challenges</h2>
          {suggestion ? (
            <div className="mt-2 rounded-2xl border border-brand-100 dark:border-surface-line bg-brand-50/50 dark:bg-brand-900/15 p-4">
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
                <PendingButton className="btn-secondary !px-4 !py-2 text-sm" pendingLabel="Starting…">
                  Start together
                </PendingButton>
              </form>
            </div>
          ) : (
            <p className="mt-1 text-sm text-ink-soft">
              Playful activities and reflections to do together.
            </p>
          )}
          <Link
            href={`/connections/${id}/explore`}
            className="mt-3 inline-block text-sm text-brand-700 underline dark:text-brand-300"
          >
            Explore all activities →
          </Link>
        </section>
      )}

      {/* Relationship Blueprint (AI; premium) */}
      {conn.status === "active" && (
        <section className="card mt-6">
          <h2 className="text-lg">Relationship Blueprint</h2>
          <p className="mt-1 text-sm text-ink-soft">
            An AI reflection on your strengths, shared goals, and areas to
            nurture.
          </p>
          <Link
            href={`/connections/${id}/blueprint`}
            className="mt-2 inline-block text-sm text-brand-700 underline dark:text-brand-300"
          >
            View Blueprint →
          </Link>
        </section>
      )}

      {/* Shared goals — both-edit, visible immediately */}
      {conn.status === "active" && (
        <SharedGoals connectionId={id} themName={themName} />
      )}

      {/* Looking back — free retrospectives once there's history */}
      {conn.status === "active" && <LookingBack connectionId={id} />}

      {conn.status === "active" && (
        <p className="mt-4 text-sm">
          <Link
            href={`/connections/${id}/history`}
            className="text-brand-700 underline dark:text-brand-300"
          >
            Everything you&apos;ve revealed →
          </Link>
        </p>
      )}

      {/* Weekly digest (AI; premium generates, both can read) */}
      {conn.status === "active" && <WeeklyDigest connectionId={id} />}

      {/* Zodiac compatibility — just for fun */}
      {conn.status === "active" && compat && (
        <section className="card mt-6 !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:bg-brand-900/20 dark:!bg-brand-900/20">
          <h2 className="text-lg text-brand-800 dark:text-brand-200">Star match ✨</h2>
          <p className="mt-1 text-sm text-ink-soft">{compat.blurb}</p>
          <p className="mt-2 text-xs text-ink-soft/80">{ZODIAC_DISCLAIMER}</p>
        </section>
      )}

      {/* Leave — anyone can step away (teen-revocable). One extra tap so a
          stray click can't archive a shared space. */}
      {conn.status !== "archived" && (
        <details className="mt-10 border-t border-gray-100 pt-6">
          <summary className="cursor-pointer list-none text-sm text-ink-soft/80 hover:text-rose-600">
            Leave this connection
          </summary>
          <div className="mt-3 rounded-lg border border-rose-200 dark:border-rose-900/50 p-4">
            <p className="text-sm text-ink-soft">
              This archives the connection for both of you. Nothing new can be
              started here afterwards, you each keep what you wrote, and the
              other person isn&apos;t notified. You can always start a new one.
            </p>
            <form action={leave} className="mt-3">
              <PendingButton
                className="btn-secondary !border-rose-300 !px-4 !py-2 text-sm !text-rose-700 hover:!bg-rose-50 dark:!text-rose-300 dark:hover:!bg-rose-950/40"
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
