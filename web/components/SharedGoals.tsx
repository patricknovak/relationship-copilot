import { createClient } from "@/lib/supabase/server";
import { addGoal, removeGoal, toggleGoal } from "@/app/actions/goals";
import PendingButton from "@/components/PendingButton";

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
      <h2 className="text-lg">Things we&apos;re trying</h2>
      <p className="mt-1 text-sm text-ink-soft">
        A shared list you both can add to and tick off. Visible to {who} as
        soon as you write it.
      </p>

      {open.length > 0 && (
        <ul className="mt-3 space-y-2">
          {open.map((g) => (
            <li key={g.id} className="flex items-start gap-2">
              <form action={toggleGoal.bind(null, connectionId, g.id, true)}>
                <PendingButton
                  className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-brand-300 text-[10px] text-transparent hover:border-brand-600 hover:text-brand-600"
                  pendingLabel="…"
                >
                  ✓
                </PendingButton>
              </form>
              <span className="flex-1 text-sm text-ink">{g.body}</span>
              <form action={removeGoal.bind(null, connectionId, g.id)}>
                <PendingButton
                  className="text-xs text-ink-soft/50 hover:text-rose-600"
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
        <PendingButton className="btn-secondary shrink-0 !px-4 !py-2 text-sm" pendingLabel="Adding…">
          Add
        </PendingButton>
      </form>

      {done.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-ink-soft/70">
            Done ({done.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {done.map((g) => (
              <li key={g.id} className="flex items-center gap-2 text-sm text-ink-soft/70">
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
