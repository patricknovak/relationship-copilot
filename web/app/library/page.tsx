import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Evidence-based education. RLS returns free articles to everyone and premium
// ones only to entitled users, so free users simply see fewer cards.
export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("education_articles")
    .select("slug, title, summary, category, framework, evidence_rating, is_premium")
    .order("category", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="eyebrow">The library</p>
      <h1 className="mt-2 text-3xl">Short reads, real research</h1>
      <p className="mt-2 text-ink-soft">
        Evidence-rated guides on building healthier relationships — honest
        about how strong the science is.
      </p>

      <ul className="mt-8 space-y-3">
        {(articles ?? []).map((a) => (
          <li key={a.slug}>
            <Link
              href={`/library/${a.slug}`}
              className="card card-hover block"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-lg text-ink">{a.title}</span>
                {a.is_premium && (
                  <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                    Premium
                  </span>
                )}
              </div>
              {a.summary && (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {a.summary}
                </p>
              )}
              {a.evidence_rating != null && (
                <p className="mt-2 text-xs text-brand-600/90">
                  Evidence: {"★".repeat(a.evidence_rating)}
                  <span className="text-brand-300">
                    {"★".repeat(Math.max(0, 5 - a.evidence_rating))}
                  </span>
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-ink-soft/70">
        More in-depth guides are part of{" "}
        <Link href="/pricing" className="underline">
          Premium
        </Link>
        .
      </p>
    </div>
  );
}
