import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCheckout } from "@/app/actions/billing";

const FREE = [
  "All relationship types",
  "20-question onboarding + mutual reveal",
  "Daily questions, reveal & discussion",
  "Education library",
  "Safety resources — always free",
];
const PREMIUM = [
  "AI Relationship Blueprint",
  "Unlimited connections",
  "Full quiz & challenge catalog",
  "Premium education library",
  "Weekly AI digests",
];

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isPremium = user
    ? (await supabase.rpc("has_premium", { uid: user.id })).data
    : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="eyebrow text-center">Pricing</p>
      <h1 className="mt-3 text-center text-4xl">Simple, honest pricing</h1>
      <p className="mt-3 text-center text-ink-soft">
        Most of Relationship Copilot is free. Premium adds the AI layer.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <Plan title="Free" price="$0" features={FREE} highlight={false}>
          {!user && (
            <Link href="/login" className="btn-secondary w-full">
              Get started
            </Link>
          )}
        </Plan>

        <Plan title="Premium" price="$18/mo" features={PREMIUM} highlight>
          {isPremium ? (
            <span className="block rounded-full bg-brand-100 px-4 py-2.5 text-center text-sm font-medium text-brand-800">
              You&apos;re on Premium ✨
            </span>
          ) : (
            <form action={createCheckout}>
              <button className="btn-primary w-full">
                Upgrade to Premium
              </button>
            </form>
          )}
        </Plan>
      </div>

      <p className="mt-8 text-center text-xs text-ink-soft/70">
        Safety detection and crisis resources are free for everyone and never
        behind the paywall.
      </p>
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
    <div
      className={`card !p-7 ${
        highlight
          ? "!rounded-3xl !border-brand-300 !bg-gradient-to-b !from-brand-50 !to-white shadow-lift"
          : "!rounded-3xl"
      }`}
    >
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="mt-1 font-display text-4xl text-ink">{price}</p>
      <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className="mt-0.5 text-brand-600">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-7">{children}</div>
    </div>
  );
}
