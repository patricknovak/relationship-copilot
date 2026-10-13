import { updateNotificationPrefs } from "@/app/actions/profile";
import PendingButton from "@/components/PendingButton";
import {
  PREF_LABELS,
  type NotificationPrefs as Prefs,
} from "@/lib/notifications";

const ORDER: (keyof Prefs)[] = ["your_turn", "revealed", "daily_ready"];

// Account → Notifications. Server-rendered form; the action merges into
// profiles.preferences under the user's own RLS. Shown even when email isn't
// configured yet, so the preference is already right when it switches on.
export default function NotificationPrefs({
  prefs,
  saved,
}: {
  prefs: Prefs;
  saved?: boolean;
}) {
  return (
    <form action={updateNotificationPrefs} className="card !p-4">
      <h2 className="text-sm font-medium">Email notifications</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Short nudges with a link, never the answers themselves. We never email
        about safety resources or about someone leaving a connection.
      </p>
      <ul className="mt-3 space-y-2.5">
        {ORDER.map((k) => (
          <li key={k}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name={k}
                defaultChecked={prefs[k]}
                className="mt-1 h-4 w-4 rounded border-surface-line accent-brand-700"
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  {PREF_LABELS[k].label}
                </span>
                <span className="block text-xs text-ink-soft">
                  {PREF_LABELS[k].detail}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <PendingButton className="btn-secondary !px-4 !py-2 text-sm" pendingLabel="Saving…">
          Save notifications
        </PendingButton>
        {saved && <span className="text-xs text-ink-soft">Saved.</span>}
      </div>
    </form>
  );
}
