import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sunSign, ZODIAC_DISCLAIMER } from "@/lib/zodiac";
import { ATTACHMENT_BLURB } from "@/lib/attachment";

type Intake = {
  goals?: string;
  values?: string;
  attachment?: { style?: keyof typeof ATTACHMENT_BLURB };
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, birthday, intake")
    .eq("id", user!.id)
    .maybeSingle();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user!.id)
    .maybeSingle();

  const intake = (profile?.intake ?? {}) as Intake;
  const sign = sunSign(profile?.birthday);
  const isPremium =
    sub?.plan === "premium" && ["active", "trialing"].includes(sub?.status ?? "");

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {profile?.display_name || "Your account"}
        </h1>
        <Link href="/onboarding" className="text-sm text-brand-700 underline">
          Edit profile
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">{user?.email}</p>

      <dl className="mt-6 space-y-4">
        <div className="rounded-lg border border-gray-100 p-4">
          <dt className="text-sm font-medium">Plan</dt>
          <dd className="mt-1 text-sm text-gray-700">
            {isPremium ? "Premium" : "Free"}
            {!isPremium && (
              <span className="ml-2 text-gray-400">
                (AI Blueprint &amp; digests unlock with Premium)
              </span>
            )}
          </dd>
        </div>

        {intake.attachment?.style && (
          <div className="rounded-lg border border-gray-100 p-4">
            <dt className="text-sm font-medium">Your relating style</dt>
            <dd className="mt-1 text-sm text-gray-700">
              <span className="font-medium">{intake.attachment.style}</span> —{" "}
              {ATTACHMENT_BLURB[intake.attachment.style]}
            </dd>
          </div>
        )}

        {sign && (
          <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
            <dt className="text-sm font-medium text-brand-700">
              Your sign <span aria-hidden>{sign.symbol}</span>
            </dt>
            <dd className="mt-1 text-sm text-gray-700">
              {sign.name} ({sign.element}) — {sign.blurb}
            </dd>
            <p className="mt-2 text-xs text-gray-400">{ZODIAC_DISCLAIMER}</p>
          </div>
        )}

        {intake.goals && (
          <div className="rounded-lg border border-gray-100 p-4">
            <dt className="text-sm font-medium">What you want right now</dt>
            <dd className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
              {intake.goals}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-8">
        <Link href="/connections" className="text-sm text-brand-700 underline">
          Go to your connections →
        </Link>
      </div>
    </div>
  );
}
