import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { connectionLabel } from "@/lib/relationships";
import { startOnboarding, ensureDaily } from "@/app/actions/prompts";
import { leaveConnection } from "@/app/actions/connections";
import { computeStreak } from "@/lib/streak";
import { zodiacCompatibility } from "@/lib/compat";
import { ZODIAC_DISCLAIMER } from "@/lib/zodiac";
import InviteShare from "@/components/InviteShare";
import WeeklyDigest from "@/components/WeeklyDigest";
import LookingBack from "@/components/LookingBack";

export default async function ConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      <Link href="/connections" className="text-sm text-gray-500 hover:text-gray-700">
        ← All connections
      </Link>
      <h1 className="mt-2 text-3xl">{connectionLabel(conn.type)}</h1>
      {streak > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-3 py-1 text-sm font-medium text-amber-800">
          🔥 {streak}-day streak
        </p>
      )}

      {/* Parent & teen: trust-first, teen-revocable. Not surveillance. */}
      {isParentTeen && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
      {inviteUrl && joinedCount < 2 && (
        <section className="card mt-6 !border-brand-200 !bg-gradient-to-br !from-brand-50 !to-white">
          <h2 className="text-lg text-brand-800">Invite your person</h2>
          <p className="mt-1 text-sm text-gray-600">
            Share this link. Once they join, you can both start the 20 questions.
          </p>
          <InviteShare url={inviteUrl} />
        </section>
      )}

      {/* Both joined — onboarding entry */}
      {joinedCount >= 2 && (
        <section className="card mt-6">
          <h2 className="text-lg">The first 20 questions</h2>
          {!instance ? (
            <>
              <p className="mt-1 text-sm text-gray-600">
                Answer thoughtfully — you&apos;ll each see the other&apos;s
                answers only after you&apos;ve both finished.
              </p>
              <form action={begin} className="mt-3">
                <button className="btn-primary">
                  Begin the 20 questions
                </button>
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
            <p className="mt-1 text-sm text-gray-600">
              You&apos;re done — waiting for the other person to finish.{" "}
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
          <p className="mt-1 text-sm text-gray-600">
            A fresh prompt each day to keep learning about each other.
          </p>
          <form action={ensureDaily.bind(null, id)} className="mt-3">
            <button className="btn-primary">
              Open today&apos;s question
            </button>
          </form>
        </section>
      )}

      {/* Quizzes & challenges */}
      {conn.status === "active" && (
        <section className="card mt-6">
          <h2 className="text-lg">Quizzes &amp; challenges</h2>
          <p className="mt-1 text-sm text-gray-600">
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
          <p className="mt-1 text-sm text-gray-600">
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
        <section className="card mt-6 !border-brand-200 !bg-gradient-to-br !from-brand-50 !to-paper-warm">
          <h2 className="text-lg text-brand-800">Star match ✨</h2>
          <p className="mt-1 text-sm text-ink-soft">{compat.blurb}</p>
          <p className="mt-2 text-xs text-ink-soft/60">{ZODIAC_DISCLAIMER}</p>
        </section>
      )}

      {/* Leave — anyone can step away (teen-revocable). */}
      {conn.status !== "archived" && (
        <form action={leave} className="mt-10 border-t border-gray-100 pt-6">
          <button className="text-sm text-gray-500 hover:text-rose-600">
            Leave this connection
          </button>
        </form>
      )}
    </div>
  );
}
