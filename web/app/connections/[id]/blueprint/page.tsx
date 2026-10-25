import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateBlueprint, setBlueprintIntakeConsent } from "@/app/actions/blueprint";
import { intakeFromProfile } from "@/lib/blueprint";
import { INLINE_RESOURCES, SAFETY_NOTE, SAFETY_PRIVACY_LINE } from "@/lib/safety";
import { isPendingInsightPayload } from "@/lib/insightRateLimit";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";
import { Icon, type IconName } from "@/components/ui/Icon";

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
    <div className="page has-tabbar">
      <Link href={`/connections/${id}`} className="back-link">
        <Icon name="arrow-left" className="h-4 w-4" />
        Back
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand-glow">
          <Icon name="wand" className="h-6 w-6" />
        </span>
        <div>
          <p className="eyebrow">AI reflection</p>
          <h1 className="mt-1 text-display-md">Relationship Blueprint</h1>
        </div>
      </div>

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
        <div className="mt-6 space-y-4">
          <Section title="Strengths" icon="sparkles" tone="brand" items={payload.strengths} />
          <Section title="Shared goals" icon="compass" tone="accent" items={payload.shared_goals} />
          <Section title="Areas to nurture" icon="sprout" tone="emerald" items={payload.focus_areas} />
          {payload.reflection && (
            <div className="card-hero">
              <h2 className="flex items-center gap-2 text-lg">
                <Icon name="heart" className="h-5 w-5 text-brand-600 dark:text-brand-300" />
                A gentle reflection
              </h2>
              <p className="mt-3 whitespace-pre-wrap font-display text-lg leading-relaxed text-ink">
                {payload.reflection}
              </p>
            </div>
          )}
          {isPremium && (
            <div className="flex flex-wrap items-center gap-3">
              {insight?.generated_at && (
                <p className="text-xs text-ink-soft/80">
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
        <div className="card-hero mt-6">
          {revealed ? (
            <>
              <p className="text-sm text-ink-soft">
                Generate an AI reflection on your strengths, shared goals, and
                areas to nurture — based on your{" "}
                {answerCount > 0 ? `${answerCount} ` : ""}first answers.
              </p>
              <form action={generate} className="mt-4">
                <PendingButton pendingLabel="Generating — this takes a moment…">
                  <Icon name="sparkles" className="h-4 w-4" />
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
        <div className="card-tint mt-6">
          <h2 className="flex items-center gap-2 font-semibold text-brand-700 dark:text-brand-300">
            <Icon name="sparkles" className="h-4 w-4" />
            A Premium feature
          </h2>
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

      {/* Shown on premium connections, and always to someone who opted in,
          so consent can be withdrawn even after a plan lapses. */}
      {user && (isPremium || iShare) && conn.status !== "archived" && (
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
          <p className="mt-3 text-xs text-ink-soft/80">
            {theyShare
              ? `${themName} has chosen to include theirs.`
              : `${themName} hasn't included theirs.`}{" "}
            Changing this affects future Blueprints, not one already written.
          </p>
        </section>
      )}

      <p className="mt-8 text-xs text-ink-soft/80">
        This is relationship-wellness guidance, not therapy or diagnosis. If
        you&apos;re struggling, our{" "}
        <Link href="/safety" className="underline">
          Safety resources
        </Link>{" "}
        are always free.
      </p>
      <p className="mt-2 text-xs text-ink-soft/80">
        How this works: to generate a Blueprint, your written answers, and
        the profile reflections of anyone who chose to include them, are sent
        to our AI provider (xAI&apos;s Grok) with names, email addresses, and
        phone numbers removed first. They are used only to produce this
        reflection. Our agreement with the AI provider (xAI) does not permit training its models on your content.
      </p>
    </div>
  );
}

const TONES = {
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200",
  accent: "bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
} as const;

function Section({
  title,
  icon,
  tone,
  items,
}: {
  title: string;
  icon: IconName;
  tone: keyof typeof TONES;
  items?: string[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="card">
      <h2 className="flex items-center gap-2.5 text-lg">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <ul className="mt-3 space-y-2.5 text-sm text-ink-soft">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <span className="leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SafetyCard() {
  return (
    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/50 dark:bg-rose-950/40">
      <h2 className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-200">
        <Icon name="lifebuoy" className="h-5 w-5" />
        You deserve support
      </h2>
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
