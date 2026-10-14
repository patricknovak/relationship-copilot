import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthLink } from "@/components/AuthHint";
import { FOR_PAGES, forPageBySlug, forPageFaqs } from "@/lib/forPages";
import { faqPageJsonLdScriptContent } from "@/lib/jsonLd";
import { canonicalUrl } from "@/lib/site";

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* type=application/ld+json is non-executable; safe under CSP. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: faqPageJsonLdScriptContent({ url, faqs }),
        }}
      />
      <p className="eyebrow">For {page.label.toLowerCase()}</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">{page.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">{page.intro}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <AuthLink signedInHref={newHref} signedOutHref={loginHref} className="btn-primary">
          Invite your person
        </AuthLink>
        <Link href="/about" className="btn-secondary">
          How it works
        </Link>
      </div>
      <p className="mt-3 text-xs text-ink-soft/70">
        Free for the core experience. Answers stay private until you&apos;ve
        both shared.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl">A few of the questions</h2>
        <p className="mt-1 text-sm text-ink-soft">
          From the daily pool and the first-questions pack for this kind of
          relationship. You each answer on your own; the reveal happens when
          both are in.
        </p>
        <ol className="mt-5 space-y-3">
          {page.samples.map((q, i) => (
            <li key={q} className="card !p-4">
              <p className="eyebrow">Question {i + 1}</p>
              <p className="mt-1 font-display text-lg leading-snug text-ink">
                &ldquo;{q}&rdquo;
              </p>
            </li>
          ))}
        </ol>
      </section>

      {page.article && (
        <p className="mt-8 text-sm text-ink-soft">
          From the library:{" "}
          <Link href={`/library/${page.article.slug}`} className="text-brand-700 underline">
            {page.article.title}
          </Link>
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-2xl">Common questions</h2>
        <div className="mt-5 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="card group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                {f.q}
                <span aria-hidden className="text-brand-500 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-12 card !rounded-3xl !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:!bg-brand-900/20 p-8 text-center">
        <p className="font-display text-xl text-ink">Start with one question.</p>
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
          <Link key={p.slug} href={`/for/${p.slug}`} className="chip">
            {p.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
