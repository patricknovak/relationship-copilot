import type { Metadata } from "next";
import Link from "next/link";
import QuestionsCta from "@/components/QuestionsCta";
import { faqPageJsonLdScriptContent } from "@/lib/jsonLd";
import {
  QUESTION_PAGES,
  QUESTIONS_BLOCK_COPY,
  QUESTIONS_HUB,
  QUESTIONS_SHARED_FAQS,
  QUESTIONS_SIGN_IN_HINT,
} from "@/lib/questionPages";
import { canonicalUrl } from "@/lib/site";

const url = canonicalUrl("/questions");

export const metadata: Metadata = {
  title: QUESTIONS_HUB.metaTitle,
  description: QUESTIONS_HUB.metaDescription,
  alternates: { canonical: url },
  openGraph: {
    title: QUESTIONS_HUB.metaTitle,
    description: QUESTIONS_HUB.metaDescription,
    url,
  },
};

export default function QuestionsHubPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: faqPageJsonLdScriptContent({
            url,
            faqs: QUESTIONS_SHARED_FAQS,
          }),
        }}
      />
      <p className="eyebrow">Question lists</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">{QUESTIONS_HUB.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">
        {QUESTIONS_HUB.intro}
      </p>

      <ul className="mt-10 space-y-4">
        {QUESTION_PAGES.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/questions/${p.slug}`}
              className="card card-hover block !p-5"
            >
              <p className="font-display text-xl text-ink">{p.title}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {p.questions.length} questions from the product packs
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-12 card !rounded-3xl !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:!bg-brand-900/20 p-8 text-center">
        <p className="mx-auto max-w-md text-sm leading-relaxed text-ink">
          {QUESTIONS_BLOCK_COPY}
        </p>
        <div className="mt-5">
          <QuestionsCta page="hub" />
        </div>
        <p className="mt-3 text-xs text-ink-soft/80">{QUESTIONS_SIGN_IN_HINT}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl">Common questions</h2>
        <div className="mt-5 space-y-3">
          {QUESTIONS_SHARED_FAQS.map((f) => (
            <details key={f.q} className="card group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                {f.q}
                <span
                  aria-hidden
                  className="text-brand-500 transition-transform group-open:rotate-45 dark:text-brand-300"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
