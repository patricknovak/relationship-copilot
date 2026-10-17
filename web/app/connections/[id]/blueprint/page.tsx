import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateBlueprint, setBlueprintIntakeConsent } from "@/app/actions/blueprint";
import { intakeFromProfile } from "@/lib/blueprint";
import { INLINE_RESOURCES, SAFETY_NOTE, SAFETY_PRIVACY_LINE } from "@/lib/safety";
import { isPendingInsightPayload } from "@/lib/insightRateLimit";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";

const ERRORS: Record<string, string> = {
  premium: "The Blueprint is a Premium feature — upgrade to generate one.",
  ratelimit:
    "A Blueprint was generated just now. Give it a few minutes before regenerating.",
  notready: "Finish your first questions together first — then the Blueprint unlocks.",
  ai: "The AI couldn't finish just now. Nothing was lost — try again in a moment.",
  consent: "Couldn't save that choice just now. Try again in a moment.",
};

const NOTICES: Record<string, string> = {
  "intake-on": "Your profile reflections will be part of your next Blueprint.",
  "intake-off": "Your profile reflections won't be used in future Blueprints.",
};

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const { error, notice } = await searchParams;
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

  // Either member's Premium covers the pair for the shared Blueprint.
  const { data: isPremium } = await supabase.rpc("connection_has_premium", {
    p_conn: id,
  });

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("status, questions")
    .eq("connection_id", id)
    .eq("kind", "onboarding")
    .maybeSingle();
  const revealed = instance?.status === "revealed";
  const answerCount = Array.isArray(instance?.questions)
    ? instance.questions.length
    : 0;

  // Skip in-flight rate-limit claims so a mid-generation refresh doesn't
  // render an empty Blueprint shell.
  const rawPayload = insight?.payload ?? null;
  const payload = (
    isPendingInsightPayload(rawPayload) ? null : rawPayload
  ) as Payload | null;
  const generate = generateBlueprint.bind(null, id);
  const setConsent = setBlueprintIntakeConsent.bind(null, id);

  // Opt-in profile reflections (0037): who in this connection chose to
  // include theirs, whether I have any written, and the other person's name.
  const [{ data: consentRows }, { data: me }, { data: memberRows }] = await Promise.all([
    supabase.from("blueprint_intake_consent").select("user_id").eq("connection_id", id),
    user
      ? supabase.from("profiles").select("intake").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("connection_members").select("user_id").eq("connection_id", id),
  ]);
  const iShare = !!user && (consentRows ?? []).some((c) => c.user_id === user.id);
  const otherId = (memberRows ?? []).map((m) => m.user_id).find((uid) => uid !== user?.id);
  const theyShare = !!otherId && (consentRows ?? []).some((c) => c.user_id === otherId);
  const hasIntake = !!intakeFromProfile(me?.intake);
  let themName = "Your person";
  if (otherId) {
    const { data: them } = await supabase
      .from("partner_profiles")
      .select("display_name")
      .eq("id", otherId)
      .maybeSingle();
    themName = them?.display_name?.trim() || themName;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/connections/${id}`} className="text-sm text-ink-soft/80 hover:text-ink-soft">
        ← Back
      </Link>
      <h1 className="mt-2 text-3xl">Relationship Blueprint</h1>

      <NoticeBanner
        tone={error ? "error" : "success"}
        message={error ? (ERRORS[error] ?? ERRORS.ai) : notice ? (NOTICES[notice] ?? null) : null}
      />

      {/* Safety-first: a high-severity signal withholds AI and shows support. */}
      {payload?.safety ? (
        <>
          <SafetyCard />
          {isPremium && (
            <form action={generate} className="mt-4">
              <PendingButton
                className="btn-secondary !px-4 !py-2 text-sm"
                pendingLabel="Trying again…"
              >
                Generate again
              </PendingButton>
            </form>
          )}
        </>
      ) : payload ? (
        <div className="mt-6 space-y-6">
          <Section title="Strengths" items={payload.strengths} />
          <Section title="Shared goals" items={payload.shared_goals} />
          <Section title="Areas to nurture" items={payload.focus_areas} />
          {payload.reflection && (
            <div className="card !p-4">
              <h2 className="font-semibold">A gentle reflection</h2>
              <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">
                {payload.reflection}
              </p>
            </div>
          )}
          {isPremium && (
            <div className="flex flex-wrap items-center gap-3">
              {insight?.generated_at && (
                <p className="text-xs text-ink-soft/60">
                  Generated{" "}
                  {new Date(insight.generated_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              <form action={generate}>
                <PendingButton
                  className="btn-secondary !px-4 !py-2 text-sm"
                  pendingLabel="Regenerating…"
                >
                  Regenerate
                </PendingButton>
              </form>
            </div>
          )}
        </div>
      ) : isPremium ? (
        <div className="mt-6 card">
          {revealed ? (
            <>
              <p className="text-sm text-ink-soft">
                Generate an AI reflection on your strengths, shared goals, and
                areas to nurture — based on your{" "}
                {answerCount > 0 ? `${answerCount} ` : ""}first answers.
              </p>
              <form action={generate} className="mt-3">
                <PendingButton pendingLabel="Generating — this takes a moment…">
                  Generate Blueprint
                </PendingButton>
              </form>
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              Finish your first questions together, then your Blueprint will be
              available here.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 card !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:bg-brand-900/20 dark:!bg-brand-900/20">
          <h2 className="font-semibold text-brand-700">A Premium feature</h2>
          <p className="mt-1 text-sm text-ink-soft">
            The AI Relationship Blueprint and weekly digests are part of Premium.
            One Premium plan covers both people in a connection. Your core
            experience — questions, daily prompts, and safety resources — stays
            free.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-block btn-primary"
          >
            See Premium
          </Link>
        </div>
      )}

      {user && isPremium && conn.status !== "archived" && (
        <section className="card mt-8 !p-4">
          <h2 className="font-semibold">Your profile reflections</h2>
          <p className="mt-1 text-sm text-ink-soft">
            What you wrote about your hopes and what matters to you, and your
            attachment reflection, are private. You can choose to let the
            Blueprint use them as background. {themName} never sees them word
            for word, though the Blueprint may reflect their themes.
          </p>
          {!hasIntake ? (
            <p className="mt-3 text-sm text-ink-soft">
              You haven&apos;t written any yet.{" "}
              <Link
                href={`/onboarding?next=${encodeURIComponent(`/connections/${id}/blueprint`)}`}
                className="text-brand-700 underline"
              >
                Add them to your profile
              </Link>
              .
            </p>
          ) : (
            <form action={setConsent} className="mt-3">
              <input type="hidden" name="share" value={iShare ? "off" : "on"} />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-ink">
                  {iShare ? "Included in your Blueprint" : "Not included"}
                </span>
                <PendingButton className="btn-secondary !px-4 !py-2 text-sm" pendingLabel="Saving…">
                  {iShare ? "Stop including mine" : "Include mine"}
                </PendingButton>
              </div>
            </form>
          )}
          <p className="mt-3 text-xs text-ink-soft/70">
            {theyShare
              ? `${themName} has chosen to include theirs.`
              : `${themName} hasn't included theirs.`}{" "}
            Changing this affects future Blueprints, not one already written.
          </p>
        </section>
      )}

      <p className="mt-8 text-xs text-ink-soft/60">
        This is relationship-wellness guidance, not therapy or diagnosis. If
        you&apos;re struggling, our{" "}
        <Link href="/safety" className="underline">
          Safety resources
        </Link>{" "}
        are always free.
      </p>
      <p className="mt-2 text-xs text-ink-soft/60">
        How this works: to generate a Blueprint, your written answers, and
        the profile reflections of anyone who chose to include them, are sent
        to our AI provider (xAI&apos;s Grok) with names, email addresses, and
        phone numbers removed first. They are used only to produce this
        reflection. Production AI stays off until a no-training agreement with
        the provider is in place.
      </p>
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="card !p-4">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 list-disc pl-5 text-sm text-ink-soft space-y-1">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function SafetyCard() {
  return (
    <div className="mt-6 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-5">
      <h2 className="font-semibold text-rose-800 dark:text-rose-200">You deserve support</h2>
      <p className="mt-1 text-sm text-rose-900 dark:text-rose-200">{SAFETY_NOTE}</p>
      <p className="mt-2 text-sm text-rose-900/90 dark:text-rose-200/90">
        {SAFETY_PRIVACY_LINE}
      </p>
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
