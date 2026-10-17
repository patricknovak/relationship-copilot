import Link from "next/link";
import { createConnection } from "@/app/actions/connections";
import { CONNECTION_TYPES, FREE_CONNECTION_CAP } from "@/lib/relationships";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";
import TimezoneField from "@/components/TimezoneField";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionType, PromptQuestion } from "@/lib/database.types";

export default async function NewConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; type?: string }>;
}) {
  const { error, type } = await searchParams;
  // Deep links from the public /for pages preselect the type.
  const preselected: ConnectionType =
    CONNECTION_TYPES.find((t) => t.value === type)?.value ?? CONNECTION_TYPES[0].value;

  // A taste of the first questions for the chosen type (template text only,
  // readable under RLS by any signed-in user). Pick a different type via
  // ?type= to see its pack; the radio itself submits the form as before.
  const supabase = await createClient();
  const { data: pack } = await supabase
    .from("prompt_templates")
    .select("questions, title")
    .eq("kind", "onboarding")
    .eq("active", true)
    .eq("relationship_type", preselected)
    .limit(1)
    .maybeSingle();
  const preview = Array.isArray(pack?.questions)
    ? (pack.questions as PromptQuestion[]).slice(0, 3).map((q) => q.text)
    : [];
  const packSize = Array.isArray(pack?.questions) ? pack.questions.length : 0;
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl">Start a new connection</h1>
      <p className="mt-2 text-ink-soft">
        Choose the kind of relationship. You&apos;ll get a link to invite the
        other person.
      </p>

      {error === "cap" ? (
        <div className="mt-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200" role="status">
          The free plan holds up to {FREE_CONNECTION_CAP} connections.{" "}
          <Link href="/pricing" className="font-medium underline">
            Premium removes the limit →
          </Link>
        </div>
      ) : (
        <NoticeBanner
          message={
            error === "type"
              ? "Pick a relationship type first."
              : error
                ? "Couldn't create the connection — please try again."
                : null
          }
        />
      )}

      <form action={createConnection} className="mt-8 space-y-4">
        <TimezoneField />
        <fieldset className="space-y-2.5">
          {CONNECTION_TYPES.map((t) => (
            <label
              key={t.value}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-100 dark:border-surface-line bg-white/80 dark:bg-surface/80 p-4 shadow-soft transition hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/70 dark:has-[:checked]:bg-brand-900/25 dark:bg-brand-900/25 has-[:checked]:shadow-lift"
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                defaultChecked={t.value === preselected}
                className="mt-1 accent-brand-700"
              />
              <span>
                <span className="block font-medium text-ink">{t.label}</span>
                <span className="block text-sm text-ink-soft">{t.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <PendingButton className="btn-primary w-full !py-3" pendingLabel="Creating…">
          Create &amp; get invite link
        </PendingButton>
      </form>

      {preview.length > 0 && (
        <section className="card mt-8 !p-5">
          <p className="eyebrow">
            Your first {packSize} questions ({CONNECTION_TYPES.find((t) => t.value === preselected)?.label})
          </p>
          <ol className="mt-2 space-y-2">
            {preview.map((q) => (
              <li key={q} className="font-display text-base leading-snug text-ink">
                &ldquo;{q}&rdquo;
              </li>
            ))}
            <li className="text-sm text-ink-soft">…and {Math.max(0, packSize - preview.length)} more, once you both join.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-soft/80">
            Previewing another type?{" "}
            {CONNECTION_TYPES.filter((t) => t.value !== preselected).map((t, i) => (
              <span key={t.value}>
                {i > 0 && " · "}
                <Link href={`/connections/new?type=${t.value}`} className="underline">
                  {t.label}
                </Link>
              </span>
            ))}
          </p>
        </section>
      )}
    </div>
  );
}
