import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { submitResponse, postDiscussion } from "@/app/actions/prompts";
import RevealWatcher from "@/components/RevealWatcher";
import type { PromptQuestion } from "@/lib/database.types";

type AnswerMap = Record<string, string>;

// Renders a single prompt instance for the current user: the answer/edit form
// while open, a waiting note once they've answered, and the side-by-side reveal
// plus discussion once everyone has answered. Shared by onboarding and daily.
export default async function PromptInstanceView({
  connectionId,
  instanceId,
  title,
}: {
  connectionId: string;
  instanceId: string;
  title: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, questions, status, template_id")
    .eq("id", instanceId)
    .maybeSingle();

  if (!instance) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-ink-soft">This question is no longer available.</p>
        <Link href={`/connections/${connectionId}`} className="text-brand-700 underline">
          ← Back
        </Link>
      </div>
    );
  }

  // Prefer the template's own title (e.g. a specific quiz/challenge name).
  let heading = title;
  if (instance.template_id) {
    const { data: tmpl } = await supabase
      .from("prompt_templates")
      .select("title")
      .eq("id", instance.template_id)
      .maybeSingle();
    if (tmpl?.title) heading = tmpl.title;
  }

  const questions = instance.questions as PromptQuestion[];
  const { data: responses } = await supabase
    .from("prompt_responses")
    .select("user_id, answers")
    .eq("instance_id", instance.id);
  const myResponse = (responses ?? []).find((r) => r.user_id === user?.id);
  const myAnswers = (myResponse?.answers ?? {}) as AnswerMap;

  // ---- Revealed ----
  if (instance.status === "revealed") {
    const { data: members } = await supabase
      .from("connection_members")
      .select("user_id")
      .eq("connection_id", connectionId);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameOf = (uid: string) => {
      if (uid === user?.id) return "You";
      const p = profiles?.find((x) => x.id === uid);
      return p?.display_name || p?.username || "Them";
    };
    const initialOf = (uid: string) => nameOf(uid).slice(0, 1).toUpperCase();

    const { data: discussion } = await supabase
      .from("prompt_discussions")
      .select("id, user_id, body, created_at")
      .eq("instance_id", instance.id)
      .order("created_at", { ascending: true });

    // Stable answer order: you first, then the other person.
    const ordered = [...(responses ?? [])].sort((a) =>
      a.user_id === user?.id ? -1 : 1,
    );

    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <RevealWatcher instanceId={instance.id} />
        <Link
          href={`/connections/${connectionId}`}
          className="text-sm text-ink-soft/70 hover:text-ink"
        >
          ← Back
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-3xl">{heading}</h1>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
            ✨ Revealed together
          </span>
        </div>

        <ol className="mt-8 space-y-6">
          {questions.map((q, i) => (
            <li key={q.id} className="card animate-fade-up !p-5">
              <p className="eyebrow">Question {i + 1}</p>
              <p className="mt-1.5 font-display text-lg leading-snug text-ink">
                {q.text}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ordered.map((r) => {
                  const mine = r.user_id === user?.id;
                  return (
                    <div
                      key={r.user_id}
                      className={`rounded-2xl border p-3.5 ${
                        mine
                          ? "border-brand-100 bg-brand-50/70"
                          : "border-amber-100 bg-amber-50/60"
                      }`}
                    >
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${
                            mine ? "bg-brand-600" : "bg-amber-600"
                          }`}
                        >
                          {initialOf(r.user_id)}
                        </span>
                        {nameOf(r.user_id)}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                        {(r.answers as AnswerMap)[q.id] || (
                          <span className="text-ink-soft/50">No answer</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        <section className="card mt-10 !p-5">
          <h2 className="text-lg">Talk about it</h2>
          <ul className="mt-4 space-y-2.5">
            {(discussion ?? []).map((d) => {
              const mine = d.user_id === user?.id;
              return (
                <li
                  key={d.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      mine
                        ? "rounded-br-md bg-brand-700 text-white"
                        : "rounded-bl-md bg-paper-warm text-ink"
                    }`}
                  >
                    {!mine && (
                      <p className="text-xs font-semibold text-brand-700">
                        {nameOf(d.user_id)}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{d.body}</p>
                  </div>
                </li>
              );
            })}
            {(!discussion || discussion.length === 0) && (
              <li className="text-sm text-ink-soft/60">
                No messages yet — start the conversation.
              </li>
            )}
          </ul>
          <form action={postDiscussion} className="mt-4 flex gap-2">
            <input type="hidden" name="instance_id" value={instance.id} />
            <input type="hidden" name="connection_id" value={connectionId} />
            <input
              name="body"
              required
              placeholder="Share a thought…"
              className="input flex-1"
            />
            <button className="btn-primary shrink-0">Send</button>
          </form>
        </section>
      </div>
    );
  }

  // ---- Not revealed: answer / edit ----
  const answered = !!myResponse;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <RevealWatcher instanceId={instance.id} />
      <Link
        href={`/connections/${connectionId}`}
        className="text-sm text-ink-soft/70 hover:text-ink"
      >
        ← Back
      </Link>
      <h1 className="mt-3 text-3xl">{heading}</h1>
      <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-paper-warm px-3 py-1.5 text-sm text-ink-soft">
        <LockIcon />
        {answered
          ? "You've answered — you can tweak it until the other person finishes, then it locks and reveals."
          : "Your answer stays private until you've both finished."}
      </p>

      <form action={submitResponse} className="mt-7 space-y-5">
        <input type="hidden" name="instance_id" value={instance.id} />
        <input type="hidden" name="connection_id" value={connectionId} />

        {questions.map((q, i) => (
          <div key={q.id} className="card !p-5">
            <p className="eyebrow">
              Question {i + 1} of {questions.length}
            </p>
            <label
              className="mt-1.5 block font-display text-lg leading-snug text-ink"
              htmlFor={`q_${q.id}`}
            >
              {q.text}
            </label>
            <Field question={q} defaultValue={myAnswers[q.id]} />
          </div>
        ))}

        <button type="submit" className="btn-primary w-full !py-3">
          {answered ? "Update my answer" : "Submit my answer"}
        </button>
      </form>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-brand-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

function Field({
  question,
  defaultValue,
}: {
  question: PromptQuestion;
  defaultValue?: string;
}) {
  const name = `q_${question.id}`;
  if (question.format === "scale") {
    const min = question.min ?? 1;
    const max = question.max ?? 10;
    const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {values.map((n) => (
          <label
            key={n}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-brand-200 bg-white text-sm text-ink-soft transition hover:border-brand-400 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-700 has-[:checked]:font-semibold has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/60 has-[:focus-visible]:ring-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={n}
              defaultChecked={
                defaultValue != null && String(n) === String(defaultValue)
              }
              className="sr-only"
            />
            {n}
          </label>
        ))}
      </div>
    );
  }
  if (question.format === "choice" && question.options) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {question.options.map((opt) => (
          <label
            key={opt}
            className="cursor-pointer rounded-full border border-brand-200 bg-white px-4 py-2 text-sm text-ink-soft transition hover:border-brand-400 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-700 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/60 has-[:focus-visible]:ring-offset-2"
          >
            <input
              type="radio"
              name={name}
              value={opt}
              defaultChecked={defaultValue === opt}
              className="sr-only"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  return (
    <textarea
      id={name}
      name={name}
      rows={3}
      defaultValue={defaultValue}
      placeholder="Write what's true for you…"
      className="input mt-3"
    />
  );
}
