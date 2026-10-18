import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderArticleBlocks, type Span } from "@/lib/markdown";
import { articleJsonLdScriptContent } from "@/lib/jsonLd";
import { canonicalUrl } from "@/lib/site";

// Per-article title + description so sharing a specific library link unfurls
// with that article's own title and summary (falls back to the OG card).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: article } = await supabase
    .from("education_articles")
    .select("title, summary")
    .eq("slug", slug)
    .maybeSingle();
  if (!article) return { title: "Library" };
  const description = article.summary ?? undefined;
  const url = canonicalUrl(`/library/${slug}`);
  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: article.title, description, url },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  // RLS hides premium articles from non-entitled users (they 404 here; the
  // list page only links to what they can read).
  const { data: article } = await supabase
    .from("education_articles")
    .select("title, summary, body, framework, evidence_rating, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!article) notFound();

  const blocks = renderArticleBlocks(article.body);
  const url = canonicalUrl(`/library/${slug}`);
  const jsonLd = articleJsonLdScriptContent({
    headline: article.title,
    description: article.summary,
    url,
    datePublished: article.created_at,
  });

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <Link
        href="/library"
        className="text-sm text-ink-soft/80 hover:text-ink"
      >
        ← Library
      </Link>
      <p className="eyebrow mt-4">
        {article.framework ? `${article.framework} · ` : ""}From the library
      </p>
      <h1 className="mt-2 text-4xl leading-tight">{article.title}</h1>
      {article.summary && (
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          {article.summary}
        </p>
      )}
      {article.evidence_rating != null && (
        <p className="mt-3 text-xs text-brand-600/90 dark:text-brand-300">
          <span className="sr-only">
            Evidence rating {article.evidence_rating} out of 5
          </span>
          <span aria-hidden>
            Evidence: {"★".repeat(article.evidence_rating)}
            <span className="text-brand-300">
              {"☆".repeat(Math.max(0, 5 - article.evidence_rating))}
            </span>
          </span>
        </p>
      )}

      <div className="mt-8 space-y-4 leading-relaxed text-ink">
        {blocks.map((block, i) =>
          block.type === "list" ? (
            <ul key={i} className="space-y-2 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"
                  />
                  <span>
                    <Spans spans={item} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p key={i}>
              <Spans spans={block.spans} />
            </p>
          ),
        )}
      </div>

      {slug === "36-questions" && (
        <section
          aria-label="Try a curated list"
          className="mt-10 rounded-2xl border border-brand-100 bg-brand-50/50 p-5 dark:border-surface-line dark:bg-brand-900/20">
          <p className="font-display text-lg text-ink">Try a curated list</p>
          <p className="mt-1 text-sm text-ink-soft">
            Browse the questions you&apos;ll answer in Relationship Copilot,
            then start a connection and answer in private.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              <Link
                href="/questions/partners"
                className="text-brand-700 underline dark:text-brand-300"
              >
                Questions to ask your partner
              </Link>
            </li>
            <li>
              <Link
                href="/questions/friends"
                className="text-brand-700 underline dark:text-brand-300"
              >
                Questions to ask a friend
              </Link>
            </li>
            <li>
              <Link
                href="/questions/family"
                className="text-brand-700 underline dark:text-brand-300"
              >
                Questions to ask family
              </Link>
            </li>
            <li>
              <Link href="/questions" className="text-brand-700 underline dark:text-brand-300">
                All question lists
              </Link>
            </li>
          </ul>
        </section>
      )}

      <p className="mt-10 border-t border-brand-100/70 dark:border-surface-line pt-6 text-xs text-ink-soft/80">
        Educational content, not therapy or medical advice. In crisis? Our{" "}
        <Link href="/safety" className="underline">
          Safety resources
        </Link>{" "}
        are always free.
      </p>
    </article>
  );
}

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.bold ? (
          <strong key={i} className="font-semibold text-ink">
            {s.text}
          </strong>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
