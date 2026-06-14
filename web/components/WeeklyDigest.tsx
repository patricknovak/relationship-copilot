import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { generateWeeklyDigest } from "@/app/actions/digest";
import { INLINE_RESOURCES, SAFETY_NOTE } from "@/lib/safety";

type Payload = {
  safety?: boolean;
  highlights?: string[];
  appreciations?: string[];
  gentle_suggestion?: string;
  reflection?: string;
};

const MIN_GAP_MS = 6 * 24 * 60 * 60 * 1000;

// Weekly digest card for the connection page (server component). Premium
// generates; everyone sees the latest digest once it exists (it's a shared
// insight). Safety-withheld digests render support resources instead.
export default async function WeeklyDigest({
  connectionId,
}: {
  connectionId: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: insight } = await supabase
    .from("relationship_insights")
    .select("payload, generated_at")
    .eq("connection_id", connectionId)
    .eq("kind", "weekly_digest")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: isPremium } = await supabase.rpc("has_premium", {
    uid: user.id,
  });

  const payload = (insight?.payload ?? null) as Payload | null;
  const generatedAt = insight?.generated_at ?? null;
  const canRegenerate =
    !generatedAt || Date.now() - new Date(generatedAt).getTime() >= MIN_GAP_MS;
  const generate = generateWeeklyDigest.bind(null, connectionId);

  return (
    <section className="card mt-6">
      <h2 className="text-lg">Weekly digest</h2>

      {payload?.safety ? (
        <div className="mt-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-4">
          <p className="text-sm text-rose-900 dark:text-rose-200">{SAFETY_NOTE}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {INLINE_RESOURCES.map((r) => (
              <li key={r.name}>
                <span className="font-medium">{r.name}:</span> {r.contact}
              </li>
            ))}
          </ul>
          <Link href="/safety" className="mt-2 inline-block text-sm underline">
            More resources →
          </Link>
        </div>
      ) : payload ? (
        <div className="mt-2 space-y-3 text-sm text-ink-soft">
          {generatedAt && (
            <p className="text-xs text-ink-soft/60">
              From your week up to {generatedAt.slice(0, 10)}
            </p>
          )}
          {!!payload.highlights?.length && (
            <div>
              <h3 className="font-medium">Bright spots</h3>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {payload.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {!!payload.appreciations?.length && (
            <div>
              <h3 className="font-medium">Worth a thank-you</h3>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                {payload.appreciations.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {payload.gentle_suggestion && (
            <div>
              <h3 className="font-medium">One small thing to try</h3>
              <p className="mt-1">{payload.gentle_suggestion}</p>
            </div>
          )}
          {payload.reflection && (
            <p className="text-ink-soft whitespace-pre-wrap">{payload.reflection}</p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">
          A short AI reflection on the week you answered together — bright
          spots, appreciations, and one small thing to try.
        </p>
      )}

      {isPremium ? (
        canRegenerate && (
          <form action={generate} className="mt-3">
            <button className="btn-primary">
              {payload ? "Generate this week's digest" : "Generate weekly digest"}
            </button>
            <p className="mt-2 text-xs text-ink-soft/60">
              Your week&apos;s revealed answers are sent to our AI provider
              (xAI&apos;s Grok) with names and contact details removed, used
              only to write this digest.
            </p>
          </form>
        )
      ) : (
        <p className="mt-3 text-sm text-ink-soft">
          Part of{" "}
          <Link href="/pricing" className="text-brand-700 underline">
            Premium
          </Link>
          {" "}— your questions, reveals, and safety resources stay free.
        </p>
      )}
    </section>
  );
}
