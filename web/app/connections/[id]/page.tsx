import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";
import { startOnboarding, ensureDaily } from "@/app/actions/prompts";
import { leaveConnection } from "@/app/actions/connections";
import { computeStreak } from "@/lib/streak";
import { zodiacCompatibility } from "@/lib/compat";
import { ZODIAC_DISCLAIMER } from "@/lib/zodiac";
import InvitePanel from "@/components/InvitePanel";
import WeeklyDigest from "@/components/WeeklyDigest";
import LookingBack from "@/components/LookingBack";
import RevealWatcher from "@/components/RevealWatcher";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";
import { setDisplayName } from "@/app/actions/profile";

const NOTICES: Record<string, { tone: "info" | "error"; text: string }> = {
  waiting: {
    tone: "info",
    text: "Once your person joins, the 20 questions unlock for you both.",
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
    .select("id, type, status, invite_code, created_by")
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

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, status")
    .eq("connection_id", id)
    .eq("kind", "onboarding")
    .maybeSingle();

  let myResponse = null;
  if (instance && user) {
    const { data } = await supabase
      .from("prompt_responses")
      .select("id")
      .eq("instance_id", instance.id)
      .eq("user_id", user.id)
      .maybeSingle();
    myResponse = data;
  }

  // Daily streak (gamification) from revealed daily instances.
  let streak = 0;
  {
    const { data: dailies } = await supabase
      .from("prompt_instances")
      .select("scheduled_for")
      .eq("connection_id", id)
      .eq("kind", "daily")
      .eq("status", "revealed");
    const dates = (dailies ?? [])
      .map((d) => d.scheduled_for)
      .filter((x): x is string => !!x);
    streak = computeStreak(dates);
  }

  // Zodiac compatibility (entertainment only).
  const memberIds = (members ?? []).map((m) => m.user_id);
  let compat: ReturnType<typeof zodiacCompatibility> = null;
  if (memberIds.length >= 2) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, birthday")
      .in("id", memberIds);
    const birthdays = memberIds.map(
      (uid) => profs?.find((p) => p.id === uid)?.birthday ?? null,
    );
    compat = zodiacCompatibility(birthdays[0], birthdays[1]);
  }

  const begin = startOnboarding.bind(null, id);
  const leave = leaveConnection.bind(null, id);
  const isParentTeen = conn.type === "parent_child";
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteUrl = conn.invite_code ? `${base}/invite/${conn.invite_code}` : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/connections" className="text-sm text-ink-soft/80 hover:text-ink-soft">
        ← All connections
      </Link>
      <h1 className="mt-2 text-3xl">{connectionLabel(conn.type)}</h1>
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

      {/* Invitees who signed in straight from an email have no name yet —
          their partner would see them as "Them". One field fixes it. */}
      {user && !myName && (
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
            Email it, text it, or share the link — one tap gets them in, and
            then you can both start the 20 questions.
          </p>
          <InvitePanel
            connectionId={id}
            url={inviteUrl}
            inviterName={myName}
          />
        </section>
      )}

      {/* Both joined — onboarding entry */}
      {joinedCount >= 2 && (
        <section className="card mt-6">
          <h2 className="text-lg">The first 20 questions</h2>
          {!instance ? (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                Answer thoughtfully — you&apos;ll each see the other&apos;s
                answers only after you&apos;ve both finished.
              </p>
              <form action={begin} className="mt-3">
                <PendingButton pendingLabel="Setting up…">
                  Begin the 20 questions
                </PendingButton>
              </form>
            </>
          ) : instance.status === "revealed" ? (
            <p className="mt-1 text-sm">
              <Link
                href={`/connections/${id}/onboarding`}
                className="text-brand-700 underline"
              >
                See your answers side by side →
              </Link>
            </p>
          ) : myResponse ? (
            <p className="mt-1 text-sm text-ink-soft">
              {instance && <RevealWatcher instanceId={instance.id} />}
              You&apos;re done — this page updates the moment they finish.{" "}
              <Link
                href={`/connections/${id}/onboarding`}
                className="text-brand-700 underline"
              >
                Review your answers
              </Link>
            </p>
          ) : (
            <p className="mt-1 text-sm">
              <Link
                href={`/connections/${id}/onboarding`}
                className="text-brand-700 underline"
              >
                Continue the 20 questions →
              </Link>
            </p>
          )}
        </section>
      )}

      {/* Daily question */}
      {conn.status === "active" && (
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
          <p className="mt-1 text-sm text-ink-soft">
            Playful activities and reflections to do together.
          </p>
          <Link
            href={`/connections/${id}/explore`}
            className="mt-2 inline-block text-sm text-brand-700 underline"
          >
            Explore activities →
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
            className="mt-2 inline-block text-sm text-brand-700 underline"
          >
            View Blueprint →
          </Link>
        </section>
      )}

      {/* Looking back — free retrospectives once there's history */}
      {conn.status === "active" && <LookingBack connectionId={id} />}

      {/* Weekly digest (AI; premium generates, both can read) */}
      {conn.status === "active" && <WeeklyDigest connectionId={id} />}

      {/* Zodiac compatibility — just for fun */}
      {conn.status === "active" && compat && (
        <section className="card mt-6 !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:bg-brand-900/20 dark:!bg-brand-900/20">
          <h2 className="text-lg text-brand-800 dark:text-brand-200">Star match ✨</h2>
          <p className="mt-1 text-sm text-ink-soft">{compat.blurb}</p>
          <p className="mt-2 text-xs text-ink-soft/60">{ZODIAC_DISCLAIMER}</p>
        </section>
      )}

      {/* Leave — anyone can step away (teen-revocable). */}
      {conn.status !== "archived" && (
        <form action={leave} className="mt-10 border-t border-gray-100 pt-6">
          <PendingButton
            className="text-sm text-ink-soft/80 hover:text-rose-600"
            pendingLabel="Leaving…"
          >
            Leave this connection
          </PendingButton>
        </form>
      )}
    </div>
  );
}
