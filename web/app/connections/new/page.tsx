import { createConnection } from "@/app/actions/connections";
import { CONNECTION_TYPES } from "@/lib/relationships";

export default function NewConnectionPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold">Start a new connection</h1>
      <p className="mt-1 text-gray-600">
        Choose the kind of relationship. You&apos;ll get a link to invite the
        other person.
      </p>

      <form action={createConnection} className="mt-6 space-y-3">
        <fieldset className="space-y-2">
          {CONNECTION_TYPES.map((t, i) => (
            <label
              key={t.value}
              className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50"
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                defaultChecked={i === 0}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{t.label}</span>
                <span className="block text-sm text-gray-500">{t.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Create &amp; get invite link
        </button>
      </form>
    </div>
  );
}
