import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Relationship Copilot",
};

// DRAFT — accurate to the app's actual behavior, but requires legal review
// before real users. Keep this page in sync with what the code really does;
// it is a description, not aspiration.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-sm text-gray-700">
      <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-1 text-xs text-gray-400">
        Draft — under legal review. Last updated June 2026.
      </p>

      <section className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">What we collect</h2>
        <p>
          Your account details (email, display name, optional birthday), your
          profile reflections, and the answers, discussions, and quiz responses
          you write inside your connections. Billing is handled by Stripe; we
          store your subscription status, not your card details.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">
          Who can see what you write
        </h2>
        <p>
          Answers are private until both people in a connection have answered
          the same prompt — this &ldquo;mutual reveal&rdquo; rule is enforced in
          our database itself, not just the app. The other member of a
          connection never sees an unrevealed answer, and neither does anyone
          else. We do not sell your data or share it with advertisers.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">AI features</h2>
        <p>
          If you use an AI feature (the Relationship Blueprint or weekly
          digest), the answers involved are sent to our AI provider
          (xAI&apos;s Grok) with names, email addresses, and phone numbers
          removed first. They are used only to produce that reflection and not
          to train models. Safety screening runs before any AI output: content
          suggesting danger leads us to withhold the AI output and show support
          resources instead. Safety features are free for everyone.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">
          Your data, your controls
        </h2>
        <p>
          You can download everything your account contains as JSON from your
          account page, and you can delete your account at any time. Deletion
          permanently removes your profile, your answers, and your activity; a
          person you shared a connection with keeps their own answers, and the
          connection is archived for them. Shared AI reflections derived from
          your answers are removed.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">Children</h2>
        <p>
          Relationship Copilot is not available to children under 13. The
          parent–teen track is designed for connection, not monitoring, and a
          teen can leave a connection at any time.
        </p>

        <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
        <p>
          Questions or requests:{" "}
          <a href="mailto:privacy@relationshipcopilot.com" className="underline">
            privacy@relationshipcopilot.com
          </a>
          . See also our{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
