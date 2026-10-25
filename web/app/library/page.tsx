import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canonicalUrl } from "@/lib/site";
import { FOR_PAGES } from "@/lib/forPages";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "Library",
  description:
    "Short, research-grounded reads on building healthier relationships — honestly rated for how strong the science is.",
  alternates: { canonical: canonicalUrl("/library") },
  openGraph: {
    title: "Library — Relationship Copilot",
    description:
      "Short, research-grounded reads on building healthier relationships — honestly rated for how strong the science is.",
    url: canonicalUrl("/library"),
  },
};

// Evidence-based education. RLS returns free articles to everyone and premium
// ones only to entitled users, so free users simply see fewer cards.
export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("education_articles")
    .select("slug, title, summary, category, framework, evidence_rating, is_premium")
    .order("category", { ascending: true });

  return (
    <div className="page-wide has-tabbar">
      <div className="max-w-2xl">
        <p className="eyebrow">The library</p>
        <h1 className="mt-2 text-display-md">Short reads, real research</h1>
        <p className="mt-3 text-ink-soft">
          Evidence-rated guides on building healthier relationships — honest
          about how strong the science is.
        </p>
      </div>

      <ul className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(articles ?? []).map((a) => (
          <li key={a.slug}>
            <Link
              href={`/library/${a.slug}`}
              className="card card-hover flex h-full flex-col"
            >
              <div className="flex items-center justify-between gap-3">
                {a.category && <span className="eyebrow">{a.category.replace(/_/g, " ")}</span>}
                {a.is_premium && <span className="pill-brand">Premium</span>}
              </div>
              <span className="mt-2 font-display text-xl leading-snug text-ink">{a.title}</span>
              {a.summary && (
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                  {a.summary}
                </p>
              )}
              {a.evidence_rating != null && (
                <p className="mt-4 flex items-center gap-1 text-xs text-ink-soft">
                  <span className="sr-only">
                    Evidence rating {a.evidence_rating} out of 5
                  </span>
                  <span aria-hidden className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon
                        key={i}
                        name="star"
                        className={`h-3.5 w-3.5 ${i < a.evidence_rating! ? "fill-brand-500 text-brand-500 dark:fill-brand-300 dark:text-brand-300" : "text-brand-200 dark:text-brand-800"}`}
                      />
                    ))}
                  </span>
                  <span aria-hidden className="ml-1">evidence</span>
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <section className="card-tint mt-12">
        <h2 className="text-lg">Questions for your…</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Sample questions and how it works, for each kind of relationship.{" "}
          <Link href="/questions" className="link">
            Longer lists on /questions
          </Link>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FOR_PAGES.map((p) => (
            <Link key={p.slug} href={`/for/${p.slug}`} className="chip chip-hover">
              {p.label}
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-ink-faint">
        More in-depth guides are part of{" "}
        <Link href="/pricing" className="link">
          Premium
        </Link>
        .
      </p>
    </div>
  );
}
