import { updateNotificationPrefs } from "@/app/actions/profile";
import PendingButton from "@/components/PendingButton";
import {
  PREF_LABELS,
  type NotificationPrefs as Prefs,
} from "@/lib/notifications";

const ORDER: (keyof Prefs)[] = ["your_turn", "revealed", "discussion_reply", "daily_ready"];

// Account → Notifications. Server-rendered form; the action merges into
// profiles.preferences under the user's own RLS. Shown even when no channel
// is configured yet, so the preference is already right when it switches on,
// and it says honestly which channels can send today.
export default function NotificationPrefs({
  prefs,
  saved,
  channels = { email: true, push: true },
}: {
  prefs: Prefs;
  saved?: boolean;
  channels?: { email: boolean; push: boolean };
}) {
  const how =
    channels.email === channels.push
      ? "by email and on any device where you turn notifications on"
      : channels.email
        ? "by email"
        : "on any device where you turn notifications on";
  return (
    <form action={updateNotificationPrefs} className="card">
      <h2 className="text-sm font-semibold text-ink">What to tell you about</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Short nudges with a link, {how}. Never the answers themselves. We never notify you
        about safety resources or about someone leaving a connection.
      </p>
      {!channels.email && !channels.push && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-paper-warm/70 px-3 py-2.5 text-xs text-ink-soft dark:bg-surface-raised/60">
          <span aria-hidden>⏳</span>
          Notifications aren&apos;t switched on yet. Your choices are saved now
          and take effect as soon as they are.
        </p>
      )}
      <ul className="mt-3 space-y-2.5">
        {ORDER.map((k) => (
          <li key={k}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 transition hover:bg-paper-warm/60">
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
        <PendingButton className="btn-secondary btn-sm" pendingLabel="Saving…">
          Save notifications
        </PendingButton>
        {saved && <span className="text-xs text-ink-soft">Saved.</span>}
      </div>
    </form>
  );
}
