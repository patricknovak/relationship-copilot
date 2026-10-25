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
import SharePublic from "@/components/SharePublic";
import { Icon } from "@/components/ui/Icon";
import { TYPE_ICON, TYPE_TINT } from "@/components/ui/Icon";
import { forPageBySlug } from "@/lib/forPages";

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
    <div className="page-wide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: faqPageJsonLdScriptContent({
            url,
            faqs: QUESTIONS_SHARED_FAQS,
          }),
        }}
      />
      <div className="max-w-2xl">
        <p className="eyebrow">Question lists</p>
        <h1 className="mt-2 text-display-lg">{QUESTIONS_HUB.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          {QUESTIONS_HUB.intro}
        </p>
        <div className="mt-5">
          <SharePublic url={url} text={QUESTIONS_HUB.title} label="Share these lists" />
        </div>
      </div>

      <ul className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUESTION_PAGES.map((p) => {
          const type = forPageBySlug(p.forSlug)?.type;
          return (
            <li key={p.slug}>
              <Link
                href={`/questions/${p.slug}`}
                className="card card-hover flex h-full flex-col !p-5"
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${type ? TYPE_TINT[type] : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"}`}>
                  <Icon name={type ? TYPE_ICON[type] : "sparkles"} className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-xl leading-snug text-ink">{p.title}</p>
                <p className="mt-1 flex-1 text-sm text-ink-soft">
                  {p.questions.length} questions from the product packs
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-300">
                  Read the list
                  <Icon name="arrow-right" className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="card-hero mt-14 text-center">
        <p className="mx-auto max-w-md text-base leading-relaxed text-ink">
          {QUESTIONS_BLOCK_COPY}
        </p>
        <div className="mt-5">
          <QuestionsCta page="hub" />
        </div>
        <p className="mt-3 text-xs text-ink-faint">{QUESTIONS_SIGN_IN_HINT}</p>
      </section>

      <section className="mx-auto mt-14 max-w-2xl">
        <h2 className="text-2xl">Common questions</h2>
        <div className="mt-5 space-y-3">
          {QUESTIONS_SHARED_FAQS.map((f) => (
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
    </div>
  );
}
