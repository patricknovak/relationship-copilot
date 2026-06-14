import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Relationship Copilot",
};

// DRAFT — requires legal review before real users.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-ink-soft">
      <h1 className="text-3xl text-ink">Terms of Service</h1>
      <p className="mt-1 text-xs text-ink-soft/60">
        Draft — under legal review. Last updated June 2026.
      </p>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-ink">The service</h2>
        <p>
          Relationship Copilot provides relationship-wellness tools: shared
          questions with mutual reveal, educational content, and optional AI
          reflections. It is <strong>not</strong> therapy, counseling, medical,
          or legal advice, and no part of the service diagnoses any condition.
          If you are in crisis, use the free resources on our{" "}
          <Link href="/safety" className="underline">
            Safety page
          </Link>{" "}
          or contact local emergency services.
        </p>

        <h2 className="text-lg font-semibold text-ink">Your account</h2>
        <p>
          You must be at least 13 to use the service and old enough to consent
          to these terms in your jurisdiction. You are responsible for what you
          write; do not post content that is unlawful or that harasses or
          endangers others.
        </p>

        <h2 className="text-lg font-semibold text-ink">Billing</h2>
        <p>
          Core features are free. Premium is a monthly subscription billed via
          Stripe and can be canceled anytime, effective at the end of the
          billing period. Safety features are never paid.
        </p>

        <h2 className="text-lg font-semibold text-ink">Your content</h2>
        <p>
          You own what you write. You grant us the limited license needed to
          operate the service — storing your content, revealing it to your
          connection per the mutual-reveal rule, and (if you use AI features)
          processing redacted excerpts to generate reflections for you.
        </p>

        <h2 className="text-lg font-semibold text-ink">Termination</h2>
        <p>
          You can delete your account at any time from your account page (see
          the{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          for what deletion does). We may suspend accounts that violate these
          terms or put others at risk.
        </p>

        <h2 className="text-lg font-semibold text-ink">Disclaimers</h2>
        <p>
          The service is provided &ldquo;as is&rdquo; without warranties. To
          the maximum extent permitted by law, our liability is limited to the
          amount you paid us in the twelve months before a claim.
        </p>
      </section>
    </div>
  );
}
