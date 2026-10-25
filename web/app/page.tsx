import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthLink } from "@/components/AuthHint";
import RevealDemo from "@/components/RevealDemo";
import { Icon, TYPE_ICON, TYPE_TINT, type IconName } from "@/components/ui/Icon";
import { ACQUISITION } from "@/lib/firstRevealCopy";
import { homepageJsonLdScriptContent } from "@/lib/jsonLd";
import { canonicalUrl } from "@/lib/site";
import { FOR_PAGES } from "@/lib/forPages";
import { homepageExploreLinks } from "@/lib/homepageExploreLinks";
import { PREMIUM_MONTHLY_DISPLAY } from "@/lib/pricing";
import { QUESTION_PAGES } from "@/lib/questionPages";
import type { ConnectionType } from "@/lib/database.types";

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl("/") },
};

const STAGES = [
  { label: "New love", note: "start with 20 questions" },
  { label: "New parents", note: "protect the friendship" },
  { label: "Growing teens", note: "trust, not surveillance" },
  { label: "Caring for parents", note: "share the load" },
  { label: "Grief & endings", note: "remember together" },
];

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: "Can the other person see my answer before I share mine?",
    a: "No. The rule that hides an answer until you've both responded is enforced in the database itself, not only in the app, so no screen can show one answer early. You answer first, then you both see everything at once.",
  },
  {
    q: "Is this therapy?",
    a: "No. Relationship Copilot offers relationship-wellness and coaching-style prompts grounded in research, but it isn't therapy, counseling, or medical advice, and it never diagnoses. If you're in crisis, our Safety page lists free, confidential support — always free and easy to reach.",
  },
  {
    q: "What happens to what I write — and what does the AI see?",
    a: "Your words are yours: you can export everything as JSON or delete your account anytime. We don't sell your data. Optional AI features strip names, emails, and phone numbers from the relevant answers before they leave our systems. Our agreement with the AI provider (xAI) does not permit training its models on your content.",
  },
  {
    q: "Is it really free?",
    a: `The core experience — every relationship type, the onboarding questions, daily prompts, reveals, discussions, and the core library — is free. Premium (${PREMIUM_MONTHLY_DISPLAY}) adds the AI Blueprint and weekly digests. Safety resources are never behind the paywall.`,
  },
  {
    q: "Is it only for couples?",
    a: "No. It's built for the whole arc of a relationship — romantic partners, friends, family, siblings, coworkers, mentors, and a trust-first parent–teen track. Each connection gets its own private space.",
  },
  {
    q: "What if I'm in an unsafe relationship?",
    a: "Safety comes first and free. When answers look like they may involve harm, we surface support resources (and withhold optional AI reflections). There's a quick-exit button on the Safety page, and we never notify the other person when you view resources or leave a connection.",
  },
  {
    q: "Who built this?",
    a: (
      <>
        Relationship Copilot is an independent product founded by Patrick Novak
        in Vancouver. Learn more on our{" "}
        <Link href="/about" className="link">
          About
        </Link>{" "}
        page.
      </>
    ),
  },
];

// /for slugs → connection types, for the icon and tint on each chip.
const FOR_TYPE: Record<string, ConnectionType> = {
  partners: "romantic",
  friends: "friend",
  siblings: "sibling",
  family: "family",
  "parents-and-teens": "parent_child",
  coworkers: "coworker",
  mentors: "mentor",
};

// Static: no session read, so the page is prerendered at build. CTAs carry
// both targets; the auth hint (components/AuthHint.tsx) shows the right one.
export default function Home() {
  const exploreLinks = homepageExploreLinks();
  const questionExplore = exploreLinks.filter((l) => l.kind === "questions");
  const forExplore = exploreLinks.filter((l) => l.kind === "for");

  return (
    <div>
      {/* JSON-LD is type=application/ld+json (non-executable); safe under CSP. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: homepageJsonLdScriptContent() }}
      />

      {/* ------------------------------------------------ Hero */}
      <section className="hero-glow relative overflow-hidden">
        <div aria-hidden className="blob -left-20 top-24 h-72 w-72 animate-drift bg-brand-300/40 dark:bg-brand-700/30" />
        <div aria-hidden className="blob -right-24 top-64 h-80 w-80 animate-drift bg-accent-200/50 [animation-delay:-6s] dark:bg-accent-900/25" />

        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-14 text-center sm:px-6 sm:pt-24">
          <p className="eyebrow animate-fade-up">For every relationship that matters</p>
          <h1 className="mx-auto mt-5 max-w-3xl animate-fade-up text-display-xl">
            {ACQUISITION.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-ink-soft [animation-delay:120ms]">
            {ACQUISITION.body}
          </p>
          <div className="mt-9 flex animate-fade-up flex-wrap items-center justify-center gap-3 [animation-delay:200ms]">
            <AuthLink
              signedInHref="/connections/new"
              signedOutHref="/login?next=/connections/new"
              className="btn-primary btn-lg"
            >
              {ACQUISITION.inviteCta}
              <Icon name="arrow-right" className="h-4 w-4" />
            </AuthLink>
            <AuthLink
              signedInHref="/connections"
              signedOutHref="/login"
              className="btn-secondary btn-lg"
              signedInChildren="Open your connections"
            >
              {ACQUISITION.startCta}
            </AuthLink>
          </div>
          <p className="mt-4 animate-fade-up text-xs text-ink-faint [animation-delay:260ms]">
            {ACQUISITION.trustLine}
          </p>

          {/* The signature moment: mutual reveal, as a living demo. */}
          <div className="relative mx-auto mt-14 max-w-3xl animate-fade-up overflow-x-clip [animation-delay:340ms]">
            <RevealDemo />
            <div
              aria-hidden
              className="absolute -inset-x-8 -bottom-10 -z-10 h-24 rounded-[100%] bg-brand-300/30 blur-3xl dark:bg-brand-700/30"
            />
          </div>

          <div className="mt-14 flex flex-wrap justify-center gap-2">
            {FOR_PAGES.map((p, i) => {
              const type = FOR_TYPE[p.slug];
              return (
                <Link
                  key={p.slug}
                  href={`/for/${p.slug}`}
                  className="chip chip-hover animate-fade-up"
                  style={{ animationDelay: `${380 + i * 60}ms` }}
                >
                  {type && (
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${TYPE_TINT[type]}`}>
                      <Icon name={TYPE_ICON[type]} className="h-3 w-3" strokeWidth={2} />
                    </span>
                  )}
                  {p.label}
                </Link>
              );
            })}
          </div>
          <p className="mt-6 animate-fade-up text-sm text-ink-soft [animation-delay:500ms]">
            Or browse{" "}
            <Link href="/questions" className="link">
              questions to ask
            </Link>
            {" — "}
            {QUESTION_PAGES.slice(0, 3).map((p, i, arr) => (
              <span key={p.slug}>
                {i > 0 ? (i === arr.length - 1 ? ", or " : ", ") : null}
                <Link href={`/questions/${p.slug}`} className="link">
                  {p.forLabel}
                </Link>
              </span>
            ))}
            .
          </p>
        </div>
      </section>

      {/* ------------------------------------------------ Trust strip */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <ul className="grid gap-3 rounded-3xl border border-surface-line bg-surface p-3 shadow-soft sm:grid-cols-3">
          <Trust icon="lock" title="Private by architecture" body="The reveal rule lives in the database, not only the app." />
          <Trust icon="lifebuoy" title="Safety is always free" body="Crisis resources for everyone, never behind Premium." />
          <Trust icon="download" title="Your words are yours" body="Export everything as JSON or delete your account anytime." />
        </ul>
      </section>

      {/* ------------------------------------------------ How it works */}
      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
        <p className="eyebrow text-center">How it works</p>
        <h2 className="mt-3 text-center text-display-md">
          Three small habits. One closer relationship.
        </h2>
        <div className="relative mt-14 grid gap-6 sm:grid-cols-3">
          <div
            aria-hidden
            className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent sm:block"
          />
          <Step n="1" icon="send" title="Invite your person" body="One link, one tap. Partner, friend, sibling, parent, teammate — every connection gets its own private space." />
          <Step n="2" icon="eye-off" title="Answer in private" body="A daily question and deeper packs, written for your kind of relationship. Designed so neither of you can peek early — built into the product, not just promised." />
          <Step n="3" icon="sparkles" title="Reveal together" body="Both answered? Everything unlocks side by side, with a place to talk about it. That moment is the whole point." />
        </div>
      </section>

      {/* ------------------------------------------------ Features */}
      <section className="bg-paper-warm/70">
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
          <p className="eyebrow text-center">What&apos;s inside</p>
          <h2 className="mt-3 text-center text-display-md">Made for the long arc</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon="sparkles"
              title="Grounded in research"
              body="Questions are informed by research traditions like Gottman and attachment theory — and we rate evidence strength in the library so weaker ideas stay honest."
            />
            <Feature
              icon="layers"
              title="Cradle to grave"
              body="Optional packs and library reads for seasons most apps skip — new love, new parents, teens, caregiving, grief."
            />
            <Feature
              icon="flame"
              title="Streaks that forgive"
              body="A daily rhythm without guilt mechanics. Miss yesterday? Catch up today and the streak holds. Miss longer and it resets gently."
            />
            <Feature
              icon="lock"
              title="Private by architecture"
              body="The reveal rule is enforced in the database itself, not only in the app, so answers stay private until you've both shared. Your words are yours to export or erase."
            />
            <Feature
              icon="book"
              title="A library worth reading"
              body="Short, evidence-rated reads — the four horsemen, bids for connection, grieving differently — free where it matters most."
            />
            <Feature
              icon="lifebuoy"
              title="Safety, never paywalled"
              body="Crisis resources are free for everyone, always free and easy to reach, with a quick-exit button when privacy matters."
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Life stages */}
      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
        <p className="eyebrow text-center">The whole arc</p>
        <h2 className="mt-3 text-center text-display-md">Built for seasons, not just sparks</h2>
        <div className="relative mt-14">
          <div
            aria-hidden
            className="absolute left-4 right-4 top-5 hidden h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent sm:block"
          />
          <ol className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-5">
            {STAGES.map((s, i) => (
              <li key={s.label} className="text-center">
                <span className="relative mx-auto block h-10 w-10 rounded-full border-2 border-brand-300 bg-paper">
                  <span
                    className="absolute inset-2 rounded-full bg-gradient-to-br from-brand-400 to-accent-400"
                    style={{ opacity: 0.55 + i * 0.1 }}
                  />
                </span>
                <p className="mt-3 font-display text-lg text-ink">{s.label}</p>
                <p className="mt-1 text-sm text-ink-soft">{s.note}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------ FAQ */}
      <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <p className="eyebrow text-center">Good questions</p>
        <h2 className="mt-3 text-center text-display-md">Before you start</h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="card group !p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-transform group-open:rotate-45 dark:bg-brand-900/40 dark:text-brand-200"
                >
                  <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-ink-soft">
          <Link href="/questions" className="link">
            Browse the questions
          </Link>
        </p>
      </section>

      {/* ------------------------------------------------ Explore (SEO internal links) */}
      <section className="mx-auto max-w-2xl px-4 pb-16 sm:px-6" aria-labelledby="explore-heading">
        <p className="eyebrow text-center">Explore</p>
        <h2 id="explore-heading" className="mt-3 text-center text-2xl sm:text-3xl">
          Questions and use cases
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ink">Question lists</p>
            <ul className="mt-3 space-y-2 text-sm">
              {questionExplore.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="link">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">For each relationship</p>
            <ul className="mt-3 space-y-2 text-sm">
              {forExplore.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="link">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Final CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="card-hero overflow-hidden text-center !p-10 sm:!p-16">
          <div aria-hidden className="blob -left-10 -top-10 h-48 w-48 bg-brand-300/40 dark:bg-brand-700/30" />
          <div aria-hidden className="blob -bottom-16 -right-10 h-56 w-56 bg-accent-200/50 dark:bg-accent-900/25" />
          <div className="relative">
            <h2 className="text-display-md">The people you love are one question away.</h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-soft">
              Start free. Invite one person. See what you learn about each other by Friday.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <AuthLink
                signedInHref="/connections"
                signedOutHref="/login"
                className="btn-primary btn-lg"
                signedInChildren="Open your connections"
              >
                Start free
              </AuthLink>
              <Link href="/pricing" className="btn-ghost">
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Trust({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-sm text-ink-soft">{body}</span>
      </span>
    </li>
  );
}

function Step({ n, icon, title, body }: { n: string; icon: IconName; title: string; body: string }) {
  return (
    <div className="card card-hover relative">
      <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand-glow">
        <Icon name={icon} className="h-6 w-6" />
        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent-400 font-display text-xs font-semibold text-white ring-2 ring-surface">
          {n}
        </span>
      </span>
      <h3 className="mt-5 font-display text-xl text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="card card-hover">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
