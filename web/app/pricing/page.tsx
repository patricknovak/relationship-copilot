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
  "Weekly AI digests & ongoing analysis",
  "AI discussion helpers",
  "Unlimited connections",
  "Full quiz & challenge catalog",
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
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-center">Simple pricing</h1>
      <p className="mt-2 text-center text-gray-600">
        Most of Relationship Copilot is free. Premium adds the AI layer.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Plan title="Free" price="$0" features={FREE} highlight={false}>
          {!user && (
            <Link
              href="/login"
              className="block rounded-md border border-gray-300 px-4 py-2 text-center text-sm font-medium hover:bg-gray-50"
            >
              Get started
            </Link>
          )}
        </Plan>

        <Plan title="Premium" price="$18/mo" features={PREMIUM} highlight>
          {isPremium ? (
            <span className="block rounded-md bg-brand-50 px-4 py-2 text-center text-sm font-medium text-brand-700">
              You&apos;re on Premium
            </span>
          ) : (
            <form action={createCheckout}>
              <button className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Upgrade to Premium
              </button>
            </form>
          )}
        </Plan>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
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
      className={`rounded-lg border p-6 ${
        highlight ? "border-brand-300 bg-brand-50/30" : "border-gray-200"
      }`}
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-2xl font-bold">{price}</p>
      <ul className="mt-4 space-y-2 text-sm text-gray-700">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-brand-600">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">{children}</div>
    </div>
  );
}
