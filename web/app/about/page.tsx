import type { Metadata } from "next";
import Link from "next/link";
import { AuthLink } from "@/components/AuthHint";
import { canonicalUrl } from "@/lib/site";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: { absolute: "About · Relationship Copilot" },
  description:
    "Closer, on purpose. Relationship Copilot helps people stay close with prompts you answer privately and only share together.",
  alternates: { canonical: canonicalUrl("/about") },
  openGraph: {
    title: "About — Relationship Copilot",
    description:
      "Closer, on purpose. Relationship Copilot helps people stay close with prompts you answer privately and only share together.",
    url: canonicalUrl("/about"),
  },
};

// Static (prerendered); CTAs follow the auth hint, see components/AuthHint.tsx.
function Privacy({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <li className="card flex gap-3 !p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  );
}

export default function AboutPage() {
  return (
    <div className="page text-sm text-ink-soft">
      <p className="eyebrow">About</p>
      <h1 className="mt-3 text-display-lg text-ink">
        About Relationship Copilot
      </h1>
      <p className="mt-5 font-display text-xl leading-relaxed text-ink">
        Closer, on purpose. Relationship Copilot helps people stay close across
        the whole arc of a relationship — romantic partners, friends, family,
        siblings, coworkers, mentors, and parent–teen — with prompts you answer
        privately and only share together.
      </p>
      <p className="mt-3 text-base leading-relaxed">
        Free where it matters. Never therapy. Built so safety stays free.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <AuthLink signedInHref="/connections/new" signedOutHref="/login?next=/connections/new" className="btn-primary">
          Invite your person
        </AuthLink>
        <AuthLink signedInHref="/connections" signedOutHref="/login" className="btn-secondary">
          Start free
        </AuthLink>
      </div>

      <section className="mt-14 space-y-4 text-base leading-relaxed">
        <h2 className="text-2xl text-ink">Why we exist</h2>
        <p>
          Most relationship products optimize for engagement: peeking, streaks,
          guilt, or couple-only romance. Real life is wider than that — new
          love, new parents, hard seasons, caregiving, grief — and trust breaks
          when someone can see your answers before you&apos;re ready.
        </p>
        <p>
          We built Relationship Copilot so two people can answer honestly on
          their own time, then reveal together. The prompts are
          research-grounded. The product is not monitoring, not therapy, and
          not a dating app.
        </p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl text-ink">
          How privacy shows up in the product
        </h2>
        <p>
          We describe product behavior here. Full legal detail lives in our
          Privacy Policy and Terms.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          <Privacy icon="eye-off">
            You answer in private. Your person answers in private. You see each
            other&apos;s answers only when you&apos;ve both shared that prompt.
          </Privacy>
          <Privacy icon="lock">
            That mutual-reveal rule is enforced in the database — not only in
            the interface.
          </Privacy>
          <Privacy icon="download">You can export your data and delete your account.</Privacy>
          <Privacy icon="wand">
            Optional AI features (like Blueprint) strip names, emails, and phone
            numbers before anything leaves our systems, and run safety
            screening. Our agreement with the AI provider (xAI) does not permit training its models on your content.
          </Privacy>
          <Privacy icon="lifebuoy">
            Crisis and safety resources are always free — never locked behind
            Premium.
          </Privacy>
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/privacy" className="link">
            Read our Privacy Policy
          </Link>
          <Link href="/terms" className="link">
            Terms
          </Link>
          <Link href="/safety" className="link">
            Safety
          </Link>
        </p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl text-ink">Who it&apos;s for</h2>
        <p>
          Anyone who wants intentional closeness without peeking or
          performance:
        </p>
        <ul className="flex flex-wrap gap-2">
          {[
            ["heart", "Romantic partners and new couples"],
            ["users", "Friends and mentors"],
            ["home", "Families, siblings, and caregivers"],
            ["briefcase", "Coworkers who want clearer conversations"],
            ["sprout", "Parents and teens building trust — not surveillance (teens can leave)"],
          ].map(([icon, label]) => (
            <li key={label} className="chip">
              <Icon name={icon as IconName} className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" />
              {label}
            </li>
          ))}
        </ul>
        <p>
          Optional question packs and library reads cover seasons most apps
          skip: new love through grief and everything in between.
        </p>
      </section>

      <section className="card-tint mt-12 space-y-4">
        <h2 className="text-2xl text-ink">Who builds this</h2>
        <p>
          Relationship Copilot is founded by{" "}
          <strong className="font-semibold text-ink">Patrick Novak</strong>,
          based in Vancouver, Canada.
        </p>
        <p>
          The product is built for people sharing sensitive, personal words with
          someone they care about. That means careful software, clear controls,
          and a refusal to turn intimacy into an attention game.
        </p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl text-ink">What we are not</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Not therapy, counseling, diagnosis, or medical advice.</li>
          <li>
            Not a crisis service — if you or someone else is in danger, use
            emergency services and see our{" "}
            <Link href="/safety" className="link">
              Safety
            </Link>{" "}
            resources.
          </li>
          <li>
            Not an ad-funded product that sells your attention or your answers.
          </li>
        </ul>
      </section>

      <section className="mt-12 rounded-3xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900/50 dark:bg-rose-950/40">
        <h2 className="flex items-center gap-2 text-2xl text-rose-900 dark:text-rose-100">
          <Icon name="lifebuoy" className="h-5 w-5" />
          Safety &amp; support
        </h2>
        <p className="mt-2 text-rose-900/90 dark:text-rose-100/90">
          If things feel unsafe, leave quickly and get help. Safety tools and
          crisis resources stay free for everyone.
        </p>
        <p className="mt-3">
          <Link href="/safety" className="btn-secondary btn-sm">
            Go to Safety
          </Link>
          <span className="ml-3 text-xs text-rose-900/80 dark:text-rose-100/80">includes quick exit and resource links</span>
        </p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl text-ink">Company &amp; policies</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
            ["Safety", "/safety"],
            ["Pricing", "/pricing"],
          ].map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="card card-hover flex items-center justify-between !p-3.5 text-sm font-medium text-ink">
                {label}
                <Icon name="chevron-right" className="h-4 w-4 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-hero mt-14 text-center">
        <p className="font-display text-2xl text-ink sm:text-3xl">
          Invite the person who matters. Answer on your own. Reveal together.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <AuthLink signedInHref="/connections/new" signedOutHref="/login?next=/connections/new" className="btn-primary">
            Invite your person
          </AuthLink>
          <AuthLink signedInHref="/connections" signedOutHref="/login" className="btn-secondary">
            Start free
          </AuthLink>
          <Link href="/safety" className="btn-ghost">
            Safety always free
          </Link>
        </div>
      </section>
    </div>
  );
}
