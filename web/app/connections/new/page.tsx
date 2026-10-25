import Link from "next/link";
import { createConnection } from "@/app/actions/connections";
import { CONNECTION_TYPES, FREE_CONNECTION_CAP } from "@/lib/relationships";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";
import TimezoneField from "@/components/TimezoneField";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionsListParam } from "@/lib/questionsCta";
import type { ConnectionType, PromptQuestion } from "@/lib/database.types";
import { Icon, TYPE_ICON, TYPE_TINT } from "@/components/ui/Icon";

export default async function NewConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; type?: string; list?: string }>;
}) {
  const { error, type, list: listRaw } = await searchParams;
  const listSlug = parseQuestionsListParam(listRaw);
  // Deep links from the public /for and /questions pages preselect the type.
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
    <div className="page-narrow has-tabbar">
      <Link href="/connections" className="back-link mb-3">
        <Icon name="arrow-left" className="h-4 w-4" />
        All connections
      </Link>
      <p className="eyebrow">New connection</p>
      <h1 className="mt-2 text-display-md">Who is this with?</h1>
      <p className="mt-3 text-ink-soft">
        Choose the kind of relationship. You&apos;ll get a private link to
        invite the other person, and the first questions are written for
        exactly this kind of pair.
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
        {listSlug ? <input type="hidden" name="list" value={listSlug} /> : null}
        <fieldset className="grid gap-2.5 sm:grid-cols-2">
          <legend className="sr-only">Relationship type</legend>
          {CONNECTION_TYPES.map((t) => (
            <label
              key={t.value}
              className="group relative flex cursor-pointer items-start gap-3 rounded-2xl border border-surface-line bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/70 has-[:checked]:shadow-lift has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/60 dark:has-[:checked]:bg-brand-900/25"
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                defaultChecked={t.value === preselected}
                className="peer sr-only"
              />
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TYPE_TINT[t.value]}`}>
                <Icon name={TYPE_ICON[t.value]} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{t.label}</span>
                <span className="block text-sm text-ink-soft">{t.blurb}</span>
              </span>
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-surface-line text-transparent transition peer-checked:border-brand-700 peer-checked:bg-brand-700 peer-checked:text-white dark:peer-checked:bg-brand-500"
              >
                <Icon name="check" className="h-3 w-3" strokeWidth={3} />
              </span>
            </label>
          ))}
        </fieldset>

        <PendingButton className="btn-primary btn-lg w-full" pendingLabel="Creating…">
          Create &amp; get invite link
          <Icon name="arrow-right" className="h-4 w-4" />
        </PendingButton>
      </form>

      {preview.length > 0 && (
        <section className="card-tint mt-8">
          <p className="eyebrow">
            Your first {packSize} questions · {CONNECTION_TYPES.find((t) => t.value === preselected)?.label}
          </p>
          <ol className="mt-3 space-y-3">
            {preview.map((q, i) => (
              <li key={q} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface font-display text-xs text-brand-700 shadow-soft dark:text-brand-200">
                  {i + 1}
                </span>
                <span className="font-display text-base leading-snug text-ink">&ldquo;{q}&rdquo;</span>
              </li>
            ))}
            <li className="pl-9 text-sm text-ink-soft">…and {Math.max(0, packSize - preview.length)} more, once you both join.</li>
          </ol>
          <p className="mt-4 text-xs text-ink-faint">
            Previewing another type?{" "}
            {CONNECTION_TYPES.filter((t) => t.value !== preselected).map((t, i) => (
              <span key={t.value}>
                {i > 0 && " · "}
                <Link
                  href={
                    listSlug
                      ? `/connections/new?type=${t.value}&list=${listSlug}`
                      : `/connections/new?type=${t.value}`
                  }
                  className="link"
                >
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
