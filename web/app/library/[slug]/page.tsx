import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/library" className="text-sm text-gray-500 hover:text-gray-700">
        ← Library
      </Link>
      <h1 className="mt-2 text-3xl">{article.title}</h1>
      {article.summary && (
        <p className="mt-1 text-gray-600">{article.summary}</p>
      )}
      <div className="mt-6 space-y-3 text-sm text-gray-800">
        {article.body.split("\n\n").map((para, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {para}
          </p>
        ))}
      </div>
      <p className="mt-8 text-xs text-gray-400">
        Educational content, not therapy or medical advice. In crisis? Our{" "}
        <Link href="/safety" className="underline">
          Safety resources
        </Link>{" "}
        are always free.
      </p>
    </article>
  );
}
