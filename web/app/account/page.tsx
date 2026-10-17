import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createBillingPortal } from "@/app/actions/billing";
import PendingButton from "@/components/PendingButton";
import { sunSign, ZODIAC_DISCLAIMER } from "@/lib/zodiac";
import { ATTACHMENT_BLURB } from "@/lib/attachment";
import DeleteAccount from "@/components/DeleteAccount";
import NoticeBanner from "@/components/NoticeBanner";
import NotificationPrefs from "@/components/NotificationPrefs";
import { parseNotificationPrefs } from "@/lib/notifications";

type Intake = {
  goals?: string;
  values?: string;
  attachment?: { style?: keyof typeof ATTACHMENT_BLURB };
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; error?: string; saved?: string }>;
}) {
  const { upgraded, error, saved } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, birthday, intake, preferences")
    .eq("id", user!.id)
    .maybeSingle();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, stripe_customer_id")
    .eq("user_id", user!.id)
    .maybeSingle();

  const intake = (profile?.intake ?? {}) as Intake;
  const notificationPrefs = parseNotificationPrefs(profile?.preferences);
  const sign = sunSign(profile?.birthday);
  const isPremium =
    sub?.plan === "premium" && ["active", "trialing"].includes(sub?.status ?? "");
  // Anyone who has ever paid has a Stripe customer and can reach the portal
  // (invoices, card, cancel/resume) even after downgrading.
  const hasBilling = !!sub?.stripe_customer_id;
  const renews = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">
          {profile?.display_name || "Your account"}
        </h1>
        <Link href="/onboarding" className="text-sm text-brand-700 underline dark:text-brand-300">
          Edit profile
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft/80">{user?.email}</p>

      <NoticeBanner
        tone="success"
        message={
          upgraded
            ? "Welcome to Premium ✨ The AI Blueprint and weekly digests are unlocked."
            : null
        }
      />
      <NoticeBanner
        message={
          error === "portal"
            ? "Couldn't open billing just now — try again in a moment, or email privacy@relationshipcopilot.com and we'll sort it out."
            : error === "nobilling"
              ? "There's no billing history on this account yet."
              : error === "prefs"
                ? "Couldn't save your notification settings — try again in a moment."
                : null
        }
      />

      <dl className="mt-6 space-y-4">
        <div className="card !p-4">
          <dt className="text-sm font-medium">Plan</dt>
          <dd className="mt-1 text-sm text-ink-soft">
            {isPremium ? "Premium" : "Free"}
            {isPremium && sub?.status === "trialing" && " (trial)"}
            {isPremium && renews && (
              <span className="ml-2 text-ink-soft/80">· renews {renews}</span>
            )}
            {!isPremium && (
              <Link href="/pricing" className="ml-2 text-brand-700 underline dark:text-brand-300">
                Unlock the AI Blueprint with Premium →
              </Link>
            )}
          </dd>
          {hasBilling && (
            <form action={createBillingPortal} className="mt-3">
              <PendingButton
                className="btn-secondary !px-4 !py-2 text-sm"
                pendingLabel="Opening billing…"
              >
                Manage billing
              </PendingButton>
              <p className="mt-1.5 text-xs text-ink-soft/80">
                Update your card, see invoices, or cancel anytime — cancellation
                takes effect at the end of the billing period.
              </p>
            </form>
          )}
        </div>

        {intake.attachment?.style && (
          <div className="card !p-4">
            <dt className="text-sm font-medium">Your relating style</dt>
            <dd className="mt-1 text-sm text-ink-soft">
              <span className="font-medium">{intake.attachment.style}</span> —{" "}
              {ATTACHMENT_BLURB[intake.attachment.style]}
            </dd>
          </div>
        )}

        {sign && (
          <div className="card !border-brand-200 dark:!border-brand-800/60 !bg-brand-50/60 dark:bg-brand-900/20 dark:!bg-brand-900/20 !p-4">
            <dt className="text-sm font-medium text-brand-700 dark:text-brand-300">
              Your sign <span aria-hidden>{sign.symbol}</span>
            </dt>
            <dd className="mt-1 text-sm text-ink-soft">
              {sign.name} ({sign.element}) — {sign.blurb}
            </dd>
            <p className="mt-2 text-xs text-ink-soft/80">{ZODIAC_DISCLAIMER}</p>
          </div>
        )}

        {intake.goals && (
          <div className="card !p-4">
            <dt className="text-sm font-medium">What you want right now</dt>
            <dd className="mt-1 text-sm text-ink-soft whitespace-pre-wrap">
              {intake.goals}
            </dd>
          </div>
        )}

        {intake.values && (
          <div className="card !p-4">
            <dt className="text-sm font-medium">What matters to you</dt>
            <dd className="mt-1 text-sm text-ink-soft whitespace-pre-wrap">
              {intake.values}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-8">
        <Link href="/connections" className="text-sm text-brand-700 underline dark:text-brand-300">
          Go to your connections →
        </Link>
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="text-sm font-semibold text-ink-soft/80 uppercase tracking-wide">
          Notifications
        </h2>
        <NotificationPrefs
          prefs={notificationPrefs}
          saved={saved === "notifications"}
        />
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="text-sm font-semibold text-ink-soft/80 uppercase tracking-wide">
          Your data
        </h2>
        <dl className="card !p-4">
          <dt className="text-sm font-medium">Download your data</dt>
          <dd className="mt-1 text-sm text-ink-soft">
            Everything your account contains — profile, answers, discussions,
            insights — as a JSON file.{" "}
            <a
              href="/api/account/export"
              className="text-brand-700 underline dark:text-brand-300"
              download
            >
              Export now
            </a>
          </dd>
        </dl>
        <DeleteAccount />
      </div>
    </div>
  );
}
