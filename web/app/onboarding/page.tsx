import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "@/app/actions/profile";
import { safeNextPath } from "@/lib/redirect";
import { ATTACHMENT_ITEMS } from "@/lib/attachment";
import { ZODIAC_DISCLAIMER } from "@/lib/zodiac";
import PendingButton from "@/components/PendingButton";
import NoticeBanner from "@/components/NoticeBanner";
import { suggestedFirstName } from "@/lib/profileName";
import { Icon } from "@/components/ui/Icon";

type Intake = {
  goals?: string;
  values?: string;
  attachment?: { style?: string } | null;
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  // After first profile setup, go straight to creating + inviting a partner.
  const next = safeNextPath(rawNext, "/connections/new");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, birthday, intake")
    .eq("id", user!.id)
    .maybeSingle();
  const intake = (profile?.intake ?? {}) as Intake;
  const isFirstRun = !profile?.display_name;

  return (
    <div className="page-narrow has-tabbar">
      <p className="eyebrow">{isFirstRun ? "Welcome" : "Your profile"}</p>
      <h1 className="mt-2 text-display-md">
        {isFirstRun ? "What should we call you?" : "Edit your profile"}
      </h1>
      <p className="mt-3 text-ink-soft">
        {isFirstRun
          ? "That's all we need to start. Everything else is optional and can wait until you want it."
          : "A few things that make your connections feel more personal. You can change these anytime."}
      </p>

      <NoticeBanner
        message={
          error === "name"
            ? "Please tell us your name — it's how your person sees you."
            : error === "birthday"
              ? "That birthday doesn't look right — it needs to be a real date in the past."
              : error
              ? "Couldn't save just now — your entries below are untouched, try again."
              : null
        }
      />

      <form action={saveProfile} className="mt-8 space-y-5">
        <input type="hidden" name="next" value={next} />
        <div className="card">
        <div>
          <label className="block text-sm font-semibold text-ink" htmlFor="display_name">
            Your name
          </label>
          <p className="mt-0.5 text-xs text-ink-faint">How your person sees you next to your answers.</p>
          <input
            id="display_name"
            name="display_name"
            required
            pattern=".*\S.*"
            title="Please enter your name"
            defaultValue={profile?.display_name ?? suggestedFirstName(user?.user_metadata)}
            className="input mt-1.5"
          />
        </div>
        </div>

        {/* First run asks for a name only; the rest waits in here. On later
            edits it is open. Collapsed fields still submit (empty), exactly
            as before, so saveProfile is unchanged. */}
        <details
          open={!isFirstRun}
          className="group space-y-5 [&>summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-dashed border-surface-line px-4 py-3 text-sm font-medium text-ink-soft transition hover:border-brand-300 hover:text-ink group-open:hidden">
            <span>Add more about you (optional)</span>
            <Icon name="plus" className="h-4 w-4" />
          </summary>
        <div className="card">
        <div>
          <label className="block text-sm font-semibold text-ink" htmlFor="birthday">
            Birthday <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id="birthday"
            name="birthday"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={profile?.birthday ?? ""}
            className="input mt-1.5 !w-auto"
          />
          <p className="mt-1 text-xs text-ink-faint">{ZODIAC_DISCLAIMER}</p>
        </div>
        </div>

        <div className="card">
        <div>
          <label className="block text-sm font-semibold text-ink" htmlFor="goals">
            What do you most want from your relationships right now?
          </label>
          <textarea
            id="goals"
            name="goals"
            rows={2}
            defaultValue={intake.goals ?? ""}
            className="input mt-1.5"
          />
        </div>

        <div className="mt-5">
          <label className="block text-sm font-semibold text-ink" htmlFor="values">
            What matters most to you in how people treat each other?
          </label>
          <textarea
            id="values"
            name="values"
            rows={2}
            defaultValue={intake.values ?? ""}
            className="input mt-1.5"
          />
        </div>
        </div>

        <fieldset className="card">
          <legend className="px-1 text-sm font-semibold text-ink">
            A quick reflection <span className="font-normal text-ink-faint">(optional)</span>
          </legend>
          <p className="text-xs text-ink-faint">
            How much do you agree? (1 = not at all, 5 = very much) — educational,
            not a diagnosis. Answer all four or skip it entirely
            {!isFirstRun && intake.attachment?.style
              ? ` — skipping keeps your current result (${intake.attachment.style}).`
              : "."}
          </p>
          <div className="mt-4 space-y-4">
            {ATTACHMENT_ITEMS.map((item) => (
              <div key={item.id}>
                <p className="text-sm text-ink">{item.text}</p>
                <div className="mt-2 flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label
                      key={n}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-surface-line bg-surface text-sm font-medium text-ink-soft shadow-soft transition hover:-translate-y-0.5 hover:border-brand-400 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-700 has-[:checked]:font-semibold has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/60 has-[:focus-visible]:ring-offset-2 dark:has-[:checked]:bg-brand-500"
                    >
                      <input
                        type="radio"
                        name={`att_${item.id}`}
                        value={n}
                        className="sr-only"
                      />
                      {n}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        </details>

        <PendingButton className="btn-primary btn-lg w-full" pendingLabel="Saving…">
          {isFirstRun ? "Continue" : "Save and continue"}
          <Icon name="arrow-right" className="h-4 w-4" />
        </PendingButton>

        {!isFirstRun && (
          <p className="text-center">
            <Link href="/account" className="btn-ghost btn-sm">
              Cancel
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
