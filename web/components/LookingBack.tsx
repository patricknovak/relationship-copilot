import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pickRetrospectives } from "@/lib/retrospective";
import type { PromptQuestion } from "@/lib/database.types";

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

  const { data: dailies } = await supabase
    .from("prompt_instances")
    .select("id, scheduled_for")
    .eq("connection_id", connectionId)
    .eq("kind", "daily")
    .eq("status", "revealed")
    .not("scheduled_for", "is", null);

  const picks = pickRetrospectives(
    (dailies ?? []).map((d) => ({
      id: d.id,
      scheduled_for: d.scheduled_for as string,
    })),
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
        .from("profiles")
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
    <section className="card mt-6 !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:bg-brand-900/20 dark:!bg-brand-900/20">
      <h2 className="text-lg text-brand-800 dark:text-brand-200">Looking back</h2>
      <div className="mt-2 space-y-4">
        {cards.map(({ pick, question, myAnswer, theirAnswer }) => (
          <div key={pick.id} className="text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft/60">
              {pick.label} — {pick.scheduled_for}
            </p>
            <p className="mt-1 font-medium text-ink">{question}</p>
            {myAnswer && (
              <p className="mt-1 text-ink-soft">
                <span className="font-medium">You:</span> {myAnswer}
              </p>
            )}
            {theirAnswer && (
              <p className="mt-1 text-ink-soft">
                <span className="font-medium">{otherName}:</span> {theirAnswer}
              </p>
            )}
            <Link
              href={`/connections/${connectionId}/prompts/${pick.id}`}
              className="mt-1 inline-block text-xs text-brand-700 underline"
            >
              Revisit →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
