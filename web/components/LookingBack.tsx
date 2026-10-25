import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pickRetrospectives } from "@/lib/retrospective";
import type { PromptQuestion } from "@/lib/database.types";
import { Icon } from "@/components/ui/Icon";

// "Looking back" (free): resurface a revealed daily question from about a
// month and a year ago, with both answers. Reads go through the session
// client, so the RLS reveal gate applies as everywhere else. Renders nothing
// until a connection has enough history — the card simply appears one day.
export default async function LookingBack({
  connectionId,
}: {
  connectionId: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Only need candidates near ~30 and ~365 days ago (± tolerance in
  // pickRetrospectives). Bound the read so long-lived connections don't pull
  // every revealed daily into memory.
  const today = new Date().toISOString().slice(0, 10);
  const oldest = new Date(`${today}T00:00:00Z`);
  oldest.setUTCDate(oldest.getUTCDate() - (365 + 14));
  const newest = new Date(`${today}T00:00:00Z`);
  newest.setUTCDate(newest.getUTCDate() - (30 - 7));
  const { data: dailies } = await supabase
    .from("prompt_instances")
    .select("id, scheduled_for")
    .eq("connection_id", connectionId)
    .eq("kind", "daily")
    .eq("status", "revealed")
    .not("scheduled_for", "is", null)
    .gte("scheduled_for", oldest.toISOString().slice(0, 10))
    .lte("scheduled_for", newest.toISOString().slice(0, 10));

  const picks = pickRetrospectives(
    (dailies ?? []).map((d) => ({
      id: d.id,
      scheduled_for: d.scheduled_for as string,
    })),
    today,
  );
  if (picks.length === 0) return null;

  const ids = picks.map((p) => p.id);
  const [{ data: instances }, { data: responses }, { data: members }] =
    await Promise.all([
      supabase.from("prompt_instances").select("id, questions").in("id", ids),
      supabase
        .from("prompt_responses")
        .select("instance_id, user_id, answers")
        .in("instance_id", ids),
      supabase
        .from("connection_members")
        .select("user_id")
        .eq("connection_id", connectionId),
    ]);

  const otherId = (members ?? []).map((m) => m.user_id).find((u) => u !== user.id);
  const { data: otherProfile } = otherId
    ? await supabase
        .from("partner_profiles")
        .select("display_name")
        .eq("id", otherId)
        .maybeSingle()
    : { data: null };
  const otherName = otherProfile?.display_name || "They";

  const cards = picks
    .map((pick) => {
      const inst = instances?.find((i) => i.id === pick.id);
      const q = (inst?.questions as PromptQuestion[] | undefined)?.[0];
      if (!q) return null;
      const mine = responses?.find(
        (r) => r.instance_id === pick.id && r.user_id === user.id,
      );
      const theirs = responses?.find(
        (r) => r.instance_id === pick.id && r.user_id !== user.id,
      );
      const myAnswer = ((mine?.answers ?? {}) as Record<string, string>)[q.id];
      const theirAnswer = ((theirs?.answers ?? {}) as Record<string, string>)[q.id];
      if (!myAnswer && !theirAnswer) return null;
      return { pick, question: q.text, myAnswer, theirAnswer };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  if (cards.length === 0) return null;

  return (
    <section className="card-tint mt-6">
      <h2 className="flex items-center gap-2.5 text-lg text-brand-800 dark:text-brand-200">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-brand-700 shadow-soft dark:text-brand-200">
          <Icon name="history" className="h-[18px] w-[18px]" />
        </span>
        Looking back
      </h2>
      <div className="mt-3 space-y-4">
        {cards.map(({ pick, question, myAnswer, theirAnswer }) => (
          <div key={pick.id} className="rounded-2xl bg-surface/80 p-4 text-sm shadow-soft dark:bg-surface-raised/60">
            <p className="eyebrow">
              {pick.label} · {pick.scheduled_for}
            </p>
            <p className="mt-1.5 font-display text-lg leading-snug text-ink">&ldquo;{question}&rdquo;</p>
            <div className="mt-3 space-y-2">
              {myAnswer && (
                <p className="rounded-xl bg-brand-50/80 px-3 py-2 text-ink dark:bg-brand-900/25">
                  <span className="font-semibold text-brand-700 dark:text-brand-300">You:</span> {myAnswer}
                </p>
              )}
              {theirAnswer && (
                <p className="rounded-xl bg-accent-50/80 px-3 py-2 text-ink dark:bg-accent-950/25">
                  <span className="font-semibold text-accent-700 dark:text-accent-300">{otherName}:</span> {theirAnswer}
                </p>
              )}
            </div>
            <Link
              href={`/connections/${connectionId}/prompts/${pick.id}`}
              className="link mt-2 inline-flex items-center gap-1 text-xs"
            >
              Revisit
              <Icon name="arrow-right" className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
