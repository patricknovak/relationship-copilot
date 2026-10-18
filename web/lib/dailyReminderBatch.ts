/**
 * Time-zone helper for the hourly reminder routes. Candidate selection and
 * batching live in SQL since migration 0040 (daily_reminder_candidates,
 * turn_reminder_candidates); this is what is still computed in the Worker.
 */

/** The hour (0–23) in a connection's time zone; UTC if the zone is bad. */
export function localHour(tz: string, now: Date): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(now);
    const n = Number.parseInt(h, 10);
    return Number.isFinite(n) ? n % 24 : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}
