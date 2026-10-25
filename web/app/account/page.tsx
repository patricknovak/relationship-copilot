import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createBillingPortal } from "@/app/actions/billing";
import PendingButton from "@/components/PendingButton";
import { sunSign, ZODIAC_DISCLAIMER } from "@/lib/zodiac";
import { ATTACHMENT_BLURB } from "@/lib/attachment";
import DeleteAccount from "@/components/DeleteAccount";
import NoticeBanner from "@/components/NoticeBanner";
import NotificationPrefs from "@/components/NotificationPrefs";
import PushToggle from "@/components/PushToggle";
import { parseNotificationPrefs } from "@/lib/notifications";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

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
    <div className="page-narrow has-tabbar">
      <div className="flex items-center gap-4">
        <Avatar name={profile?.display_name ?? user?.email ?? "?"} size="xl" variant="you" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Your account</p>
          <h1 className="mt-1 truncate text-display-md">
            {profile?.display_name || "Your account"}
          </h1>
          <p className="mt-1 truncate text-sm text-ink-soft">{user?.email}</p>
        </div>
        <Link href="/onboarding" className="btn-secondary btn-sm shrink-0">
          Edit profile
        </Link>
      </div>

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

      <dl className="mt-8 space-y-4">
        <div className={isPremium ? "card-hero" : "card"}>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon name="sparkles" className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              Plan
            </dt>
            <span className={isPremium ? "pill-action" : "pill-quiet"}>
              {isPremium ? "Premium" : "Free"}
              {isPremium && sub?.status === "trialing" && " · trial"}
            </span>
          </div>
          <dd className="mt-2 text-sm text-ink-soft">
            {isPremium && renews && <span>Renews {renews}.</span>}
            {!isPremium && (
              <span>
                The core experience is free.{" "}
                <Link href="/pricing" className="link">
                  Unlock the AI Blueprint with Premium
                </Link>
              </span>
            )}
          </dd>
          {hasBilling && (
            <form action={createBillingPortal} className="mt-3">
              <PendingButton
                className="btn-secondary btn-sm"
                pendingLabel="Opening billing…"
              >
                Manage billing
              </PendingButton>
              <p className="mt-1.5 text-xs text-ink-faint">
                Update your card, see invoices, or cancel anytime — cancellation
                takes effect at the end of the billing period.
              </p>
            </form>
          )}
        </div>

        {intake.attachment?.style && (
          <div className="card">
            <dt className="text-sm font-semibold text-ink">Your relating style</dt>
            <dd className="mt-1 text-sm text-ink-soft">
              <span className="font-medium">{intake.attachment.style}</span> —{" "}
              {ATTACHMENT_BLURB[intake.attachment.style]}
            </dd>
          </div>
        )}

        {sign && (
          <div className="card-warm">
            <dt className="text-sm font-semibold text-accent-800 dark:text-accent-200">
              Your sign <span aria-hidden>{sign.symbol}</span>
            </dt>
            <dd className="mt-1 text-sm text-ink-soft">
              {sign.name} ({sign.element}) — {sign.blurb}
            </dd>
            <p className="mt-2 text-xs text-ink-faint">{ZODIAC_DISCLAIMER}</p>
          </div>
        )}

        {intake.goals && (
          <div className="card">
            <dt className="text-sm font-semibold text-ink">What you want right now</dt>
            <dd className="mt-1 text-sm text-ink-soft whitespace-pre-wrap">
              {intake.goals}
            </dd>
          </div>
        )}

        {intake.values && (
          <div className="card">
            <dt className="text-sm font-semibold text-ink">What matters to you</dt>
            <dd className="mt-1 text-sm text-ink-soft whitespace-pre-wrap">
              {intake.values}
            </dd>
          </div>
        )}
      </dl>

      <Link href="/connections" className="card card-hover mt-6 flex items-center gap-3 !p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
          <Icon name="rings" className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1 text-sm font-semibold text-ink">Go to your connections</span>
        <Icon name="chevron-right" className="h-5 w-5 text-ink-faint" />
      </Link>

      <div className="mt-10 space-y-4">
        <h2 className="flex items-center gap-2 text-lg">
          <Icon name="bell" className="h-5 w-5 text-brand-600 dark:text-brand-300" />
          Notifications
        </h2>
        <NotificationPrefs
          prefs={notificationPrefs}
          saved={saved === "notifications"}
        />
        <PushToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY?.trim() || null} />
      </div>

      <div className="mt-10 space-y-4">
        <h2 className="flex items-center gap-2 text-lg">
          <Icon name="shield" className="h-5 w-5 text-brand-600 dark:text-brand-300" />
          Your data
        </h2>
        <dl className="card">
          <dt className="text-sm font-semibold text-ink">Download your data</dt>
          <dd className="mt-1 text-sm text-ink-soft">
            Everything your account contains — profile, answers, discussions,
            insights — as a JSON file.
          </dd>
          <a
            href="/api/account/export"
            className="btn-secondary btn-sm mt-3 inline-flex"
            download
          >
            <Icon name="download" className="h-4 w-4" />
            Export now
          </a>
        </dl>
        <DeleteAccount />
      </div>
    </div>
  );
}
