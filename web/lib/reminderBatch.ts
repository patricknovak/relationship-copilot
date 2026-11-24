// Batching rules shared by the hourly "your turn" jobs (missed-notification
// sweep and the 36-hour reminder). Pure, so the rules are unit-tested without
// a database: nobody is emailed outside their connection's local daytime
// window, and nobody gets more than one of these per run however many sets
// are waiting on them.

import { localHour } from "@/lib/dailyReminderBatch";

export interface ReminderPick {
  recipient_id: string;
  timezone: string | null;
}

export interface ReminderBatch<T> {
  /** At most one pick per recipient, all inside their local window. */
  send: T[];
  /** Picks skipped because it is night-time for that connection. */
  outsideWindow: number;
  /** Picks held back because the recipient already has one (now or recently). */
  held: number;
}

/**
 * `taken` holds recipients who already got a nudge (earlier in this run, or
 * recently according to notification_log). It is updated in place so the
 * next job in the same run sees who this one picked.
 */
export function onePerRecipientInWindow<T extends ReminderPick>(
  picks: readonly T[],
  now: Date,
  fromHour: number,
  toHour: number,
  taken: Set<string>,
): ReminderBatch<T> {
  const out: ReminderBatch<T> = { send: [], outsideWindow: 0, held: 0 };
  for (const pick of picks) {
    const hour = localHour(pick.timezone || "UTC", now);
    if (hour < fromHour || hour > toHour) {
      out.outsideWindow += 1;
      continue;
    }
    if (taken.has(pick.recipient_id)) {
      out.held += 1;
      continue;
    }
    taken.add(pick.recipient_id);
    out.send.push(pick);
  }
  return out;
}
