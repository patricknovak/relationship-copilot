// Pure shaping for the account export: the questions that go with the
// user's answers. prompt_responses.answers is keyed by question id
// ({"q1": "..."}), which is unreadable on its own, and data portability
// means a person can read what they exported. Framework-free and tested.

export type ExportInstance = {
  id: string;
  connection_id: string;
  kind: string;
  status: string;
  scheduled_for: string | null;
  questions: unknown;
};

export type ExportPrompt = {
  instance_id: string;
  connection_id: string;
  kind: string;
  status: string;
  /** Null for the first-questions set, which has no calendar day. */
  date: string | null;
  questions: { id: string; text: string }[];
};

// The first set is pinned to a sentinel date for uniqueness
// (ONBOARDING_DATE); it is not a real day and must not be exported as one.
const SENTINEL_DATE = "2000-01-01";

/** One entry per instance the user answered, with question id and text only. */
export function exportPrompts(
  instances: ExportInstance[] | null | undefined,
  answeredInstanceIds: Iterable<string>,
): ExportPrompt[] {
  const answered = new Set(answeredInstanceIds);
  return (instances ?? [])
    .filter((i) => answered.has(i.id))
    .map((i) => ({
      instance_id: i.id,
      connection_id: i.connection_id,
      kind: i.kind,
      status: i.status,
      date: i.scheduled_for && i.scheduled_for !== SENTINEL_DATE ? i.scheduled_for : null,
      questions: (Array.isArray(i.questions) ? i.questions : []).flatMap((q) => {
        if (!q || typeof q !== "object") return [];
        const { id, text } = q as { id?: unknown; text?: unknown };
        return typeof id === "string" && typeof text === "string" ? [{ id, text }] : [];
      }),
    }));
}
