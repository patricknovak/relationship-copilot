// Pure helpers for quizzes and challenges ("electives"). Framework-free.
//
// A pair may do the same elective more than once, but only one run of it is
// in progress at a time: starting it again while a run is still open must
// rejoin that run. Otherwise each person "starts" their own copy, answers it
// alone, and neither copy can ever reveal.

export type ElectiveRun = {
  id: string;
  template_id: string | null;
  status: string;
  created_at?: string | null;
};

/** The newest still-open run of this template, if any. */
export function openElectiveRun<T extends ElectiveRun>(
  runs: T[] | null | undefined,
  templateId: string,
): T | null {
  const open = (runs ?? []).filter(
    (r) => r.template_id === templateId && r.status === "open",
  );
  if (open.length === 0) return null;
  return open.reduce((a, b) => ((b.created_at ?? "") > (a.created_at ?? "") ? b : a));
}

/** Button label on the Explore list for a template's latest state. */
export function electiveCta(state: "revealed" | "open" | undefined): string {
  if (state === "open") return "Continue";
  if (state === "revealed") return "Do it again";
  return "Start";
}
