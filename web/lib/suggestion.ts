// Pick one not-yet-started elective for the hub, rotating weekly. Pure, so
// the choice is stable for a whole week (no re-roll on every refresh) and
// testable. `today` is the connection-local YYYY-MM-DD.

export interface ElectiveTemplate {
  id: string;
  kind: string;
  title: string;
  description: string | null;
}

export function weekIndex(today: string): number {
  const d = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000));
}

export function pickWeeklySuggestion<T extends ElectiveTemplate>(
  templates: T[],
  started: Set<string | null>,
  today: string,
): T | null {
  const candidates = templates
    .filter((t) => t.title && !started.has(t.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (candidates.length === 0) return null;
  return candidates[weekIndex(today) % candidates.length];
}
