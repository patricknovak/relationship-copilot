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
      <h1 className="text-2xl font-bold">Library</h1>
      <p className="mt-1 text-gray-600">
        Short, research-grounded reads on building healthier relationships.
      </p>

      <ul className="mt-6 space-y-3">
        {(articles ?? []).map((a) => (
          <li key={a.slug}>
            <Link
              href={`/library/${a.slug}`}
              className="block rounded-lg border border-gray-100 p-4 hover:border-brand-200 hover:bg-brand-50/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{a.title}</span>
                {a.is_premium && (
                  <span className="text-xs rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">
                    Premium
                  </span>
                )}
              </div>
              {a.summary && (
                <p className="mt-1 text-sm text-gray-500">{a.summary}</p>
              )}
              {a.evidence_rating != null && (
                <p className="mt-1 text-xs text-gray-400">
                  Evidence: {"★".repeat(a.evidence_rating)}
                  {"☆".repeat(Math.max(0, 5 - a.evidence_rating))}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-gray-400">
        More in-depth guides are part of{" "}
        <Link href="/pricing" className="underline">
          Premium
        </Link>
        .
      </p>
    </div>
  );
}
