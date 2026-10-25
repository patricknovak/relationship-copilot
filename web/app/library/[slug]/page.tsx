import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderArticleBlocks, type Span } from "@/lib/markdown";
import { articleJsonLdScriptContent } from "@/lib/jsonLd";
import { canonicalUrl } from "@/lib/site";
import { Icon } from "@/components/ui/Icon";
import SharePublic from "@/components/SharePublic";

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
    <article className="page has-tabbar">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <Link href="/library" className="back-link">
        <Icon name="arrow-left" className="h-4 w-4" />
        Library
      </Link>
      <p className="eyebrow mt-4">
        {article.framework ? `${article.framework} · ` : ""}From the library
      </p>
      <h1 className="mt-2 text-display-lg">{article.title}</h1>
      {article.summary && (
        <p className="mt-4 font-display text-xl leading-relaxed text-ink-soft">
          {article.summary}
        </p>
      )}
      {article.evidence_rating != null && (
        <p className="mt-4 flex items-center gap-1 text-xs text-ink-soft">
          <span className="sr-only">
            Evidence rating {article.evidence_rating} out of 5
          </span>
          <span aria-hidden className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Icon
                key={i}
                name="star"
                className={`h-3.5 w-3.5 ${i < article.evidence_rating! ? "fill-brand-500 text-brand-500 dark:fill-brand-300 dark:text-brand-300" : "text-brand-200 dark:text-brand-800"}`}
              />
            ))}
          </span>
          <span aria-hidden className="ml-1">evidence strength</span>
        </p>
      )}

      <div className="prose-article hairline mt-8 space-y-5 pt-8">
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

      <div className="hairline mt-10 pt-6">
        <SharePublic url={url} text={article.title} label="Share this read" />
      </div>
      <p className="mt-6 text-sm text-ink-soft">
        <Link href="/questions" className="link">
          Browse the questions
        </Link>
      </p>
      <p className="mt-4 text-xs text-ink-soft/80">
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
