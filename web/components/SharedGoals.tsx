import { createClient } from "@/lib/supabase/server";
import { addGoal, removeGoal, toggleGoal } from "@/app/actions/goals";
import PendingButton from "@/components/PendingButton";
import { Icon } from "@/components/ui/Icon";

// "Things we're trying": a short both-edit list on the hub. Reads under RLS
// (members only). Shared on purpose from the moment it is written, which
// the copy says plainly so nobody mistakes it for a private note.
export default async function SharedGoals({
  connectionId,
  themName,
}: {
  connectionId: string;
  themName: string | null;
}) {
  const supabase = await createClient();
  const { data: goals } = await supabase
    .from("connection_goals")
    .select("id, body, done_at, created_by, created_at")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: true });

  const open = (goals ?? []).filter((g) => !g.done_at);
  const done = (goals ?? []).filter((g) => g.done_at);
  const who = themName?.trim() || "they";

  return (
    <section id="goals" className="card mt-6 scroll-mt-24">
      <h2 className="flex items-center gap-2.5 text-lg">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
          <Icon name="sprout" className="h-[18px] w-[18px]" />
        </span>
        Things we&apos;re trying
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        A shared list you both can add to and tick off. Visible to {who} as
        soon as you write it.
      </p>

      {open.length > 0 && (
        <ul className="mt-3 space-y-2">
          {open.map((g) => (
            <li key={g.id} className="group flex items-start gap-3 rounded-xl px-2 py-1.5 transition hover:bg-paper-warm/60">
              <form action={toggleGoal.bind(null, connectionId, g.id, true)}>
                <PendingButton
                  className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand-300 text-transparent transition hover:border-brand-600 hover:bg-brand-600 hover:text-white"
                  pendingLabel="…"
                >
                  <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                </PendingButton>
              </form>
              <span className="flex-1 pt-0.5 text-sm text-ink">{g.body}</span>
              <form action={removeGoal.bind(null, connectionId, g.id)}>
                <PendingButton
                  className="text-xs text-ink-faint transition hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  pendingLabel="…"
                >
                  Remove
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addGoal.bind(null, connectionId)} className="mt-3 flex gap-2">
        <input
          name="body"
          required
          maxLength={200}
          placeholder="Something to try, keep, or do together"
          aria-label="New shared goal"
          className="input flex-1"
        />
        <PendingButton className="btn-secondary btn-sm shrink-0" pendingLabel="Adding…">
          <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
          Add
        </PendingButton>
      </form>

      {done.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-ink-faint hover:text-ink [&::-webkit-details-marker]:hidden">
            Done ({done.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {done.map((g) => (
              <li key={g.id} className="flex items-center gap-2 text-sm text-ink-soft/80">
                <span className="line-through">{g.body}</span>
                <form action={toggleGoal.bind(null, connectionId, g.id, false)}>
                  <PendingButton className="text-xs underline hover:text-ink" pendingLabel="…">
                    Undo
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
