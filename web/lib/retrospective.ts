// "Looking back": resurface what the two of you answered about a month and a
// year ago. This is the compounding value of answering daily — pure date
// logic here, framework-free and unit-tested; the component does the I/O.

export interface RetroCandidate {
  id: string;
  scheduled_for: string; // YYYY-MM-DD
}

export interface RetroPick {
  id: string;
  scheduled_for: string;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + delta * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) /
      DAY_MS,
  );
}

// Closest candidate to `target` within `tolerance` days, or null.
function closest(
  candidates: RetroCandidate[],
  target: string,
  tolerance: number,
): RetroCandidate | null {
  let best: RetroCandidate | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = daysBetween(c.scheduled_for, target);
    if (dist <= tolerance && dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

// Pick up to two retrospectives: ~a month ago (±3 days) and ~a year ago
// (±7 days). The same instance never appears twice.
export function pickRetrospectives(
  candidates: RetroCandidate[],
  todayStr?: string,
): RetroPick[] {
  const today = todayStr ?? new Date().toISOString().slice(0, 10);
  const picks: RetroPick[] = [];

  const yearAgo = closest(candidates, addDays(today, -365), 7);
  if (yearAgo) {
    picks.push({ ...yearAgo, label: "A year ago" });
  }

  const monthAgo = closest(
    candidates.filter((c) => c.id !== yearAgo?.id),
    addDays(today, -30),
    3,
  );
  if (monthAgo) {
    picks.push({ ...monthAgo, label: "About a month ago" });
  }

  return picks;
}
