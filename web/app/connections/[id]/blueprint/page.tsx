import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateBlueprint } from "@/app/actions/blueprint";
import { INLINE_RESOURCES, SAFETY_NOTE } from "@/lib/safety";

type Payload = {
  safety?: boolean;
  categories?: string[];
  strengths?: string[];
  shared_goals?: string[];
  focus_areas?: string[];
  reflection?: string;
};

export default async function BlueprintPage({
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
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!conn) notFound();

  const { data: insight } = await supabase
    .from("relationship_insights")
    .select("payload, safety_flags, model, generated_at")
    .eq("connection_id", id)
    .eq("kind", "blueprint")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: isPremium } = await supabase.rpc("has_premium", {
    uid: user!.id,
  });

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("status")
    .eq("connection_id", id)
    .eq("kind", "onboarding")
    .maybeSingle();
  const revealed = instance?.status === "revealed";

  const payload = (insight?.payload ?? null) as Payload | null;
  const generate = generateBlueprint.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/connections/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl">Relationship Blueprint</h1>

      {/* Safety-first: a high-severity signal withholds AI and shows support. */}
      {payload?.safety ? (
        <SafetyCard />
      ) : payload ? (
        <div className="mt-6 space-y-6">
          <Section title="Strengths" items={payload.strengths} />
          <Section title="Shared goals" items={payload.shared_goals} />
          <Section title="Areas to nurture" items={payload.focus_areas} />
          {payload.reflection && (
            <div className="card !p-4">
              <h2 className="font-semibold">A gentle reflection</h2>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                {payload.reflection}
              </p>
            </div>
          )}
        </div>
      ) : isPremium ? (
        <div className="mt-6 card">
          {revealed ? (
            <>
              <p className="text-sm text-gray-600">
                Generate an AI reflection on your strengths, shared goals, and
                areas to nurture — based on your 20 answers.
              </p>
              <form action={generate} className="mt-3">
                <button className="btn-primary">
                  Generate Blueprint
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Finish the 20 questions together first, then your Blueprint will be
              available here.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 card !border-brand-200 !bg-gradient-to-br !from-brand-50 !to-white">
          <h2 className="font-semibold text-brand-700">A Premium feature</h2>
          <p className="mt-1 text-sm text-gray-600">
            The AI Relationship Blueprint and weekly digests are part of Premium.
            Your core experience — questions, daily prompts, and safety resources
            — stays free.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-block btn-primary"
          >
            See Premium
          </Link>
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400">
        This is relationship-wellness guidance, not therapy or diagnosis. If
        you&apos;re struggling, our{" "}
        <Link href="/safety" className="underline">
          Safety resources
        </Link>{" "}
        are always free.
      </p>
      <p className="mt-2 text-xs text-gray-400">
        How this works: to generate a Blueprint, your written answers are sent
        to our AI provider (xAI&apos;s Grok) with names, email addresses, and
        phone numbers removed first. They are used only to produce this
        reflection and are not used to train models.
      </p>
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="card !p-4">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function SafetyCard() {
  return (
    <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-5">
      <h2 className="font-semibold text-rose-800">You deserve support</h2>
      <p className="mt-1 text-sm text-rose-900">{SAFETY_NOTE}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {INLINE_RESOURCES.map((r) => (
          <li key={r.name}>
            <span className="font-medium">{r.name}:</span> {r.contact}
          </li>
        ))}
      </ul>
      <Link href="/safety" className="mt-3 inline-block text-sm underline">
        More resources →
      </Link>
    </div>
  );
}
