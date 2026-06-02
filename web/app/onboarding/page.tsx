import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "@/app/actions/profile";
import { ATTACHMENT_ITEMS } from "@/lib/attachment";
import { ZODIAC_DISCLAIMER } from "@/lib/zodiac";

type Intake = { goals?: string; values?: string };

export default async function OnboardingPage() {
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

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold">Set up your profile</h1>
      <p className="mt-1 text-gray-600">
        A few quick things so your connections feel more personal. You can
        change these anytime.
      </p>

      <form action={saveProfile} className="mt-6 space-y-6">
        <div>
          <label className="block text-sm font-medium" htmlFor="display_name">
            Your name
          </label>
          <input
            id="display_name"
            name="display_name"
            required
            defaultValue={profile?.display_name ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="birthday">
            Birthday <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="birthday"
            name="birthday"
            type="date"
            defaultValue={profile?.birthday ?? ""}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">{ZODIAC_DISCLAIMER}</p>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="goals">
            What do you most want from your relationships right now?
          </label>
          <textarea
            id="goals"
            name="goals"
            rows={2}
            defaultValue={intake.goals ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="values">
            What matters most to you in how people treat each other?
          </label>
          <textarea
            id="values"
            name="values"
            rows={2}
            defaultValue={intake.values ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="rounded-lg border border-gray-100 p-4">
          <legend className="px-1 text-sm font-medium">
            A quick reflection
          </legend>
          <p className="text-xs text-gray-500">
            How much do you agree? (1 = not at all, 5 = very much) — educational,
            not a diagnosis.
          </p>
          <div className="mt-3 space-y-3">
            {ATTACHMENT_ITEMS.map((item) => (
              <div key={item.id}>
                <p className="text-sm">{item.text}</p>
                <div className="mt-1 flex gap-3 text-sm">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="flex items-center gap-1">
                      <input
                        type="radio"
                        name={`att_${item.id}`}
                        value={n}
                        defaultChecked={n === 3}
                      />
                      {n}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Save and continue
        </button>
      </form>
    </div>
  );
}
