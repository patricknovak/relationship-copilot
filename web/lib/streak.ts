// Daily-prompt streak (gamification port). Counts consecutive days, ending
// today (or yesterday, so a streak isn't "lost" until a full day is missed),
// for which the connection has a revealed daily instance. Dates are UTC
// YYYY-MM-DD strings.

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(revealedDates: string[], todayStr?: string): number {
  const set = new Set(revealedDates);
  const today = todayStr ?? new Date().toISOString().slice(0, 10);

  let cursor = today;
  if (!set.has(cursor)) {
    cursor = addDays(today, -1);
    if (!set.has(cursor)) return 0; // nothing today or yesterday
  }

  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}
