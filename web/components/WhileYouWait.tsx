import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FOR_PAGES } from "@/lib/forPages";
import { QUESTION_PAGES } from "@/lib/questionPages";
import type { ConnectionType } from "@/lib/database.types";
import { Icon } from "@/components/ui/Icon";

// The inviter's wait used to be dead time: they had answered, the link was
// out, and the hub offered nothing until their person joined. This gives the
// wait something to do: a couple of short reads for this kind of relationship
// and a look at what the two of you will be asked next. Public content only;
// nothing here touches either person's answers.
export default async function WhileYouWait({ type }: { type: ConnectionType }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("education_articles")
    .select("slug, title, summary, relationship_type")
    .eq("published", true)
    .eq("is_premium", false)
    .or(`relationship_type.eq.${type},relationship_type.is.null`)
    .order("evidence_rating", { ascending: false, nullsFirst: false })
    .limit(12);
  // Reads written for this relationship first, then general ones.
  const reads = [...(rows ?? [])]
    .sort((a, b) => Number(b.relationship_type === type) - Number(a.relationship_type === type))
    .slice(0, 2);

  const forPage = FOR_PAGES.find((p) => p.type === type) ?? null;
  const questionsPage = forPage
    ? (QUESTION_PAGES.find((q) => q.forSlug === forPage.slug) ?? null)
    : null;
  const samples = (forPage?.samples ?? []).slice(0, 2);

  if (reads.length === 0 && samples.length === 0) return null;

  return (
    <section className="card mt-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200">
          <Icon name="clock" className="h-[18px] w-[18px]" />
        </span>
        <div>
          <p className="eyebrow">While you wait</p>
          <h2 className="text-lg">Something for the in-between</h2>
        </div>
      </div>

      {samples.length > 0 && (
        <div className="mt-4 rounded-2xl bg-paper-warm/70 p-4 dark:bg-surface-raised/60">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Coming up for the two of you
          </p>
          <ul className="mt-2 space-y-2">
            {samples.map((q) => (
              <li key={q} className="font-display text-base leading-snug text-ink">
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
          {(questionsPage || forPage) && (
            <Link
              href={questionsPage ? `/questions/${questionsPage.slug}` : `/for/${forPage!.slug}`}
              className="link mt-3 inline-flex items-center gap-1 text-sm"
            >
              See more questions like these
              <Icon name="arrow-right" className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      {reads.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {reads.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/library/${a.slug}`}
                className="card card-hover flex h-full flex-col !p-4"
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-faint">
                  <Icon name="book" className="h-3.5 w-3.5" />
                  Short read
                </span>
                <span className="mt-1.5 font-display text-base leading-snug text-ink">{a.title}</span>
                {a.summary && (
                  <span className="mt-1 line-clamp-2 text-sm text-ink-soft">{a.summary}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        Not heard back? Links get buried. Sending it again from the card above
        is the most common nudge that works.
      </p>
    </section>
  );
}
