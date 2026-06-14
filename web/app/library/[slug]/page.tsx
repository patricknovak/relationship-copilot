import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { renderArticleBlocks, type Span } from "@/lib/markdown";

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
  return {
    title: article.title,
    description,
    openGraph: { title: article.title, description },
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
    .select("title, summary, body, framework, evidence_rating")
    .eq("slug", slug)
    .maybeSingle();
  if (!article) notFound();

  const blocks = renderArticleBlocks(article.body);

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/library"
        className="text-sm text-ink-soft/70 hover:text-ink"
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
        <p className="mt-3 text-xs text-brand-600/90">
          Evidence: {"★".repeat(article.evidence_rating)}
          <span className="text-brand-300">
            {"★".repeat(Math.max(0, 5 - article.evidence_rating))}
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

      <p className="mt-10 border-t border-brand-100/70 pt-6 text-xs text-ink-soft/70">
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
