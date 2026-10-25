import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCheckout } from "@/app/actions/billing";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";
import { canonicalUrl } from "@/lib/site";
import { FREE_CONNECTION_CAP } from "@/lib/relationships";
import { PREMIUM_MONTHLY_DISPLAY } from "@/lib/pricing";
import { pricingJsonLdScriptContent } from "@/lib/jsonLd";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "Pricing",
  // Display price and the homepage JSON-LD offer both come from lib/pricing.ts.
  // (no shared display-price constant in the codebase).
  description: `Free: up to ${FREE_CONNECTION_CAP} connections, onboarding and mutual reveal, daily questions, the core library and Safety. Premium (${PREMIUM_MONTHLY_DISPLAY}) adds the AI Blueprint and more.`,
  alternates: { canonical: canonicalUrl("/pricing") },
  openGraph: {
    title: "Pricing — Relationship Copilot",
    description: `Free for the core experience. Premium (${PREMIUM_MONTHLY_DISPLAY}) adds the AI Blueprint and weekly digests, and covers both people.`,
    url: canonicalUrl("/pricing"),
  },
};

const FREE = [
  "All relationship types",
  `Up to ${FREE_CONNECTION_CAP} connections`,
  "20 onboarding questions + mutual reveal",
  "Daily questions, reveal & discussion",
  "Quizzes & challenges",
  "Core education library",
  "Safety resources — always free",
];
const PREMIUM = [
  "AI Relationship Blueprint",
  "Weekly AI digests",
  "Covers both people in every connection you share",
  "Unlimited connections",
  "Deeper premium library reads",
];

// Annual plan appears only once the price exists in Stripe and env.
const ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_ANNUAL;
const ANNUAL_DISPLAY = process.env.NEXT_PUBLIC_PREMIUM_ANNUAL_DISPLAY;

// Verifiable claims only — every line here mirrors Privacy and About.
const FAQS: { q: string; a: string }[] = [
  {
    q: "What's free?",
    a: `Up to ${FREE_CONNECTION_CAP} connections, the onboarding questions and mutual reveal, daily questions, discussion, quizzes and challenges, the core library articles, and Safety resources.`,
  },
  {
    q: "Does the other person need to pay too?",
    a: "No. When Premium is active on a connection, Blueprint and digests are available to both people in that connection — the other person does not need their own subscription.",
  },
  {
    q: "Can the other person see my answers early?",
    a: "No. The rule that hides an answer until you've both shared is enforced in the database itself, not only in the app.",
  },
  {
    q: "Is my data used to train AI?",
    a: "No. Our agreement with the AI provider (xAI) does not permit training its models on your content. Names, emails, and phone numbers are stripped before anything is sent, and AI features are optional.",
  },
  {
    q: "Is Safety ever paywalled?",
    a: "No. Safety resources are free for everyone, always.",
  },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPremium = user
    ? (await supabase.rpc("has_premium", { uid: user.id })).data
    : false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      {/* JSON-LD is type=application/ld+json (non-executable); safe under CSP. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: pricingJsonLdScriptContent({
            url: canonicalUrl("/pricing"),
            faqs: FAQS,
            freeFeatures: FREE,
            premiumFeatures: PREMIUM,
          }),
        }}
      />
      <p className="eyebrow text-center">Pricing</p>
      <h1 className="mt-3 text-center text-display-lg">Simple, honest pricing</h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-ink-soft">
        Most of Relationship Copilot is free. Premium adds the AI layer, and one plan covers both people in a connection.
      </p>

      <NoticeBanner
        message={
          error === "checkout"
            ? "Checkout couldn't start — you weren't charged. Please try again."
            : null
        }
      />

      <div className="mt-12 grid gap-6 sm:grid-cols-2 sm:items-start">
        <Plan title="Free" price="$0" features={FREE} highlight={false}>
          {user ? (
            <Link href="/connections" className="btn-secondary btn-lg w-full">
              Go to your connections
            </Link>
          ) : (
            <Link href="/login" className="btn-secondary btn-lg w-full">
              Get started
            </Link>
          )}
        </Plan>

        <Plan title="Premium" price={PREMIUM_MONTHLY_DISPLAY} features={PREMIUM} highlight>
          {isPremium ? (
            <span className="flex items-center justify-center gap-2 rounded-full bg-brand-100 px-4 py-2.5 text-center text-sm font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
              <Icon name="sparkles" className="h-4 w-4" />
              You&apos;re on Premium
            </span>
          ) : (
            <div className="space-y-2">
              <form action={createCheckout}>
                <input type="hidden" name="interval" value="month" />
                <PendingButton className="btn-primary btn-lg w-full" pendingLabel="Opening checkout…">
                  Upgrade to Premium
                </PendingButton>
              </form>
              {ANNUAL_PRICE_ID && ANNUAL_DISPLAY && (
                <form action={createCheckout}>
                  <input type="hidden" name="interval" value="year" />
                  <PendingButton
                    className="btn-secondary w-full !py-2 text-sm"
                    pendingLabel="Opening checkout…"
                  >
                    Or {ANNUAL_DISPLAY}, billed yearly
                  </PendingButton>
                </form>
              )}
            </div>
          )}
        </Plan>
      </div>

      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-faint">
        <span className="inline-flex items-center gap-1.5"><Icon name="lifebuoy" className="h-3.5 w-3.5" /> Safety is always free</span>
        <span className="inline-flex items-center gap-1.5"><Icon name="lock" className="h-3.5 w-3.5" /> No peeking, by design</span>
        <span className="inline-flex items-center gap-1.5"><Icon name="check" className="h-3.5 w-3.5" /> Cancel anytime</span>
      </p>

      <section className="mx-auto mt-16 max-w-2xl">
        <h2 className="text-center text-display-md">Common questions</h2>
        <div className="mt-8 space-y-3">
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
      </section>
    </div>
  );
}

function Plan({
  title,
  price,
  features,
  highlight,
  children,
}: {
  title: string;
  price: string;
  features: string[];
  highlight: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative ${highlight ? "card-hero" : "card !rounded-3xl !p-6 sm:!p-7"}`}>
      {highlight && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-3 py-1 text-xs font-semibold text-white shadow-soft">
          <Icon name="sparkles" className="h-3.5 w-3.5" />
          Covers both people
        </span>
      )}
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="mt-2 font-display text-5xl tracking-tight text-ink">{price}</p>
      <ul className="mt-6 space-y-3 text-sm text-ink-soft">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${highlight ? "bg-brand-700 text-white dark:bg-brand-500" : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"}`}>
              <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-8">{children}</div>
      <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-faint">
        <Link href="/safety" className="hover:text-ink">
          Safety
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
      </p>
    </div>
  );
}
