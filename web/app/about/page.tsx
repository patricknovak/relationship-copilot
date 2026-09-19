import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { absolute: "About · Relationship Copilot" },
  description:
    "Closer, on purpose. Relationship Copilot helps people stay close with prompts you answer privately and only share together.",
};

export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const startHref = user ? "/connections" : "/login";
  const inviteHref = user
    ? "/connections/new"
    : "/login?next=/connections/new";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-ink-soft">
      <p className="eyebrow">About</p>
      <h1 className="mt-3 text-4xl text-ink sm:text-5xl">Closer, on purpose.</h1>
      <p className="mt-4 text-base leading-relaxed">
        Relationship Copilot helps people stay close across the whole arc of a
        relationship — romantic partners, friends, family, siblings, coworkers,
        mentors, and parent–teen — with prompts you answer privately and only
        share together.
      </p>
      <p className="mt-3 text-base leading-relaxed">
        Free where it matters. Never therapy. Built so safety stays free.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href={inviteHref} className="btn-primary">
          Invite your person
        </Link>
        <Link href={startHref} className="btn-secondary">
          Start free
        </Link>
      </div>

      <section className="mt-12 space-y-4">
        <h2 className="text-lg font-semibold text-ink">Why we exist</h2>
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

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-ink">
          How privacy shows up in the product
        </h2>
        <p>
          We describe product behavior here. Full legal detail lives in our
          Privacy Policy and Terms.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You answer in private. Your person answers in private. You see each
            other&apos;s answers only when you&apos;ve both shared that prompt.
          </li>
          <li>
            That mutual-reveal rule is enforced in the database — not only in
            the interface.
          </li>
          <li>You can export your data and delete your account.</li>
          <li>
            Optional AI features (like Blueprint) use redacted inputs and safety
            screening. We do not use your intimate answers to train models.
          </li>
          <li>
            Crisis and safety resources are always free — never locked behind
            Premium.
          </li>
        </ul>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/privacy" className="underline">
            Read our Privacy Policy
          </Link>
          <Link href="/terms" className="underline">
            Terms
          </Link>
          <Link href="/safety" className="underline">
            Safety
          </Link>
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-ink">Who it&apos;s for</h2>
        <p>
          Anyone who wants intentional closeness without peeking or
          performance:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Romantic partners and new couples</li>
          <li>Friends and mentors</li>
          <li>Families, siblings, and caregivers</li>
          <li>Coworkers who want clearer conversations</li>
          <li>
            Parents and teens building trust — not surveillance (teens can
            leave)
          </li>
        </ul>
        <p>
          Life-season packs cover the moments most apps skip: new love through
          grief and everything in between.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-ink">Who builds this</h2>
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

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-ink">What we are not</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Not therapy, counseling, diagnosis, or medical advice.</li>
          <li>
            Not a crisis service — if you or someone else is in danger, use
            emergency services and see our{" "}
            <Link href="/safety" className="underline">
              Safety
            </Link>{" "}
            resources.
          </li>
          <li>
            Not an ad-funded product that sells your attention or your answers.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-ink">Safety &amp; support</h2>
        <p>
          If things feel unsafe, leave quickly and get help. Safety tools and
          crisis resources stay free for everyone.
        </p>
        <p>
          <Link href="/safety" className="underline">
            Go to Safety
          </Link>{" "}
          — includes quick exit and resource links.
        </p>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-ink">Company &amp; policies</h2>
        <ul className="space-y-2">
          <li>
            Privacy —{" "}
            <Link href="/privacy" className="underline">
              /privacy
            </Link>
          </li>
          <li>
            Terms —{" "}
            <Link href="/terms" className="underline">
              /terms
            </Link>
          </li>
          <li>
            Safety —{" "}
            <Link href="/safety" className="underline">
              /safety
            </Link>
          </li>
          <li>
            Pricing —{" "}
            <Link href="/pricing" className="underline">
              /pricing
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-12 border-t border-brand-100 pt-10 dark:border-surface-line">
        <p className="font-display text-xl text-ink sm:text-2xl">
          Invite the person who matters. Answer on your own. Reveal together.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={inviteHref} className="btn-primary">
            Invite your person
          </Link>
          <Link href={startHref} className="btn-secondary">
            Start free
          </Link>
          <Link href="/safety" className="btn-ghost">
            Safety always free
          </Link>
        </div>
      </section>
    </div>
  );
}
