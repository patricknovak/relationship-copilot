import { createConnection } from "@/app/actions/connections";
import { CONNECTION_TYPES } from "@/lib/relationships";

export default function NewConnectionPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl">Start a new connection</h1>
      <p className="mt-2 text-ink-soft">
        Choose the kind of relationship. You&apos;ll get a link to invite the
        other person.
      </p>

      <form action={createConnection} className="mt-8 space-y-4">
        <fieldset className="space-y-2.5">
          {CONNECTION_TYPES.map((t, i) => (
            <label
              key={t.value}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-100 dark:border-surface-line bg-white/80 dark:bg-surface/80 p-4 shadow-soft transition hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/70 dark:has-[:checked]:bg-brand-900/25 dark:bg-brand-900/25 has-[:checked]:shadow-lift"
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                defaultChecked={i === 0}
                className="mt-1 accent-brand-700"
              />
              <span>
                <span className="block font-medium text-ink">{t.label}</span>
                <span className="block text-sm text-ink-soft">{t.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <button type="submit" className="btn-primary w-full !py-3">
          Create &amp; get invite link
        </button>
      </form>
    </div>
  );
}
