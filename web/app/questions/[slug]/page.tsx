import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QuestionsCta from "@/components/QuestionsCta";
import { faqPageJsonLdScriptContent } from "@/lib/jsonLd";
import {
  QUESTION_PAGES,
  QUESTIONS_BLOCK_COPY,
  QUESTIONS_SIGN_IN_HINT,
  questionPageBySlug,
} from "@/lib/questionPages";
import { canonicalUrl } from "@/lib/site";
import SharePublic from "@/components/SharePublic";
import { Icon } from "@/components/ui/Icon";

export function generateStaticParams() {
  return QUESTION_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = questionPageBySlug(slug);
  if (!page) return { title: "Questions" };
  const url = canonicalUrl(`/questions/${page.slug}`);
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url,
    },
  };
}

export default async function QuestionsTypePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = questionPageBySlug(slug);
  if (!page) notFound();

  const url = canonicalUrl(`/questions/${page.slug}`);

  return (
    <div className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: faqPageJsonLdScriptContent({ url, faqs: page.faqs }),
        }}
      />
      <Link href="/questions" className="back-link">
        <Icon name="arrow-left" className="h-4 w-4" />
        All question lists
      </Link>
      <p className="eyebrow mt-4">From the product packs</p>
      <h1 className="mt-2 text-display-lg">{page.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">{page.intro}</p>
      <div className="mt-5">
        <SharePublic url={url} text={page.title} label="Share this list" />
      </div>

      <ol className="stagger mt-10 space-y-3">
        {page.questions.map((q, i) => (
          <li key={q.text} className="card flex gap-4 !p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 font-display text-base text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">
              {i + 1}
            </span>
            <p className="pt-1.5 font-display text-lg leading-snug text-ink">
              &ldquo;{q.text}&rdquo;
            </p>
          </li>
        ))}
      </ol>

      <section className="card-hero mt-12 text-center">
        <p className="mx-auto max-w-md text-base leading-relaxed text-ink">
          {QUESTIONS_BLOCK_COPY}
        </p>
        <div className="mt-5">
          <QuestionsCta page={page.slug} listSlug={page.slug} />
        </div>
        <p className="mt-3 text-xs text-ink-faint">{QUESTIONS_SIGN_IN_HINT}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">Common questions</h2>
        <div className="mt-5 space-y-3">
          {page.faqs.map((f) => (
            <details key={f.q} className="card group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <Icon
                  name="plus"
                  className="h-4 w-4 shrink-0 text-brand-500 transition-transform group-open:rotate-45 dark:text-brand-300"
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm text-ink-soft">
        Also see{" "}
        <Link href={`/for/${page.forSlug}`} className="link">
          questions for {page.forLabel}
        </Link>{" "}
        and the{" "}
        <Link href="/questions" className="link">
          full questions hub
        </Link>
        .
      </p>
    </div>
  );
}
