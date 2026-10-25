import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthLink } from "@/components/AuthHint";
import { FOR_PAGES, forPageBySlug, forPageFaqs } from "@/lib/forPages";
import { faqPageJsonLdScriptContent } from "@/lib/jsonLd";
import { questionPageBySlug } from "@/lib/questionPages";
import { canonicalUrl } from "@/lib/site";
import SharePublic from "@/components/SharePublic";
import { Icon, TYPE_ICON, TYPE_TINT } from "@/components/ui/Icon";

export function generateStaticParams() {
  return FOR_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = forPageBySlug(slug);
  if (!page) return { title: "Questions" };
  const url = canonicalUrl(`/for/${page.slug}`);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: { title: page.title, description: page.description, url },
  };
}

// Public landing page per relationship type: the product's main
// differentiator (every relationship, not just couples) finally has a URL
// for each audience. Static content only; no user data.
export default async function ForPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = forPageBySlug(slug);
  if (!page) notFound();

  // No session read: these pages prerender at build (generateStaticParams).
  const newHref = `/connections/new?type=${page.type}`;
  const loginHref = `/login?next=${encodeURIComponent(newHref)}`;
  const faqs = forPageFaqs(page);
  const url = canonicalUrl(`/for/${page.slug}`);
  // Only link when /questions/<slug> exists (avoids 404 if this PR lands before the expanded question pages).
  const questionsPage = questionPageBySlug(page.slug);

  return (
    <div className="page">
      {/* type=application/ld+json is non-executable; safe under CSP. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: faqPageJsonLdScriptContent({ url, faqs }),
        }}
      />
      <div className="flex items-start gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-soft ${TYPE_TINT[page.type]}`}>
          <Icon name={TYPE_ICON[page.type]} className="h-7 w-7" />
        </span>
        <div>
          <p className="eyebrow">For {page.label.toLowerCase()}</p>
          <h1 className="mt-2 text-display-lg">{page.title}</h1>
        </div>
      </div>
      <p className="mt-5 text-base leading-relaxed text-ink-soft">{page.intro}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <AuthLink signedInHref={newHref} signedOutHref={loginHref} className="btn-primary btn-lg">
          Invite your person
        </AuthLink>
        <Link href="/about" className="btn-secondary btn-lg">
          How it works
        </Link>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon name="lock" className="h-3.5 w-3.5" />
        Free for the core experience. Answers stay private until you&apos;ve
        both shared.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <SharePublic url={url} text={page.title} label="Share this page" />
        {questionsPage ? (
          <Link
            href={`/questions/${questionsPage.slug}`}
            className="link inline-flex items-center gap-1 text-sm"
          >
            See the questions for {questionsPage.forLabel}
            <Icon name="arrow-right" className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl">A few of the questions</h2>
        <p className="mt-1 text-sm text-ink-soft">
          From the daily pool and the first-questions pack for this kind of
          relationship. You each answer on your own; the reveal happens when
          both are in.
        </p>
        <ol className="stagger mt-5 space-y-3">
          {page.samples.map((q, i) => (
            <li key={q} className="card flex gap-4 !p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 font-display text-base text-brand-800 dark:bg-brand-900/40 dark:text-brand-100">
                {i + 1}
              </span>
              <p className="pt-1.5 font-display text-lg leading-snug text-ink">
                &ldquo;{q}&rdquo;
              </p>
            </li>
          ))}
        </ol>
      </section>

      {page.article && (
        <Link href={`/library/${page.article.slug}`} className="card card-hover mt-8 flex items-center gap-3 !p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200">
            <Icon name="book" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="eyebrow block">From the library</span>
            <span className="block font-display text-lg leading-snug text-ink">{page.article.title}</span>
          </span>
          <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-ink-faint" />
        </Link>
      )}

      <section className="mt-12">
        <h2 className="text-2xl">Common questions</h2>
        <div className="mt-5 space-y-3">
          {faqs.map((f) => (
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

      <section className="card-hero mt-12 text-center">
        <p className="font-display text-2xl text-ink">Start with one question.</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          Create the connection, send the link, and your first questions
          unlock the moment they join.
        </p>
        <AuthLink signedInHref={newHref} signedOutHref={loginHref} className="btn-primary mt-5">
          Invite your person
        </AuthLink>
      </section>

      <nav className="mt-10 flex flex-wrap gap-2 text-sm" aria-label="Other relationships">
        {FOR_PAGES.filter((p) => p.slug !== page.slug).map((p) => (
          <Link key={p.slug} href={`/for/${p.slug}`} className="chip chip-hover">
            <Icon name={TYPE_ICON[p.type]} className="h-3.5 w-3.5" />
            {p.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
