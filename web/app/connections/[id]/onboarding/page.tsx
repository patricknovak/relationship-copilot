import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitResponse, postDiscussion } from "@/app/actions/prompts";
import type { PromptQuestion } from "@/lib/database.types";

type AnswerMap = Record<string, string>;

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: instance } = await supabase
    .from("prompt_instances")
    .select("id, questions, status")
    .eq("connection_id", id)
    .eq("kind", "onboarding")
    .maybeSingle();
  if (!instance) redirect(`/connections/${id}`);

  const questions = instance.questions as PromptQuestion[];

  // RLS returns only my answer until the instance is revealed, then both.
  const { data: responses } = await supabase
    .from("prompt_responses")
    .select("user_id, answers")
    .eq("instance_id", instance.id);

  const myResponse = (responses ?? []).find((r) => r.user_id === user?.id);
  const myAnswers = (myResponse?.answers ?? {}) as AnswerMap;

  // ---- Revealed: show both sides + discussion ----
  if (instance.status === "revealed") {
    const { data: members } = await supabase
      .from("connection_members")
      .select("user_id")
      .eq("connection_id", id);
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

    const { data: discussion } = await supabase
      .from("prompt_discussions")
      .select("id, user_id, body, created_at")
      .eq("instance_id", instance.id)
      .order("created_at", { ascending: true });

    const post = postDiscussion;

    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link href={`/connections/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Your answers, revealed</h1>

        <ol className="mt-6 space-y-6">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-lg border border-gray-100 p-4">
              <p className="font-medium">
                {i + 1}. {q.text}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(responses ?? []).map((r) => (
                  <div key={r.user_id} className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-brand-700">
                      {nameOf(r.user_id)}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {(r.answers as AnswerMap)[q.id] || (
                        <span className="text-gray-400">No answer</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-10">
          <h2 className="font-semibold">Talk about it</h2>
          <ul className="mt-3 space-y-2">
            {(discussion ?? []).map((d) => (
              <li key={d.id} className="rounded-md bg-gray-50 p-3 text-sm">
                <span className="font-semibold text-brand-700">
                  {nameOf(d.user_id)}:
                </span>{" "}
                <span className="whitespace-pre-wrap">{d.body}</span>
              </li>
            ))}
            {(!discussion || discussion.length === 0) && (
              <li className="text-sm text-gray-400">
                No messages yet — start the conversation.
              </li>
            )}
          </ul>
          <form action={post} className="mt-3 flex gap-2">
            <input type="hidden" name="instance_id" value={instance.id} />
            <input type="hidden" name="connection_id" value={id} />
            <input
              name="body"
              required
              placeholder="Share a thought…"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Send
            </button>
          </form>
        </section>
      </div>
    );
  }

  // ---- Not revealed: answer / edit form ----
  const answered = !!myResponse;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/connections/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold">The first 20 questions</h1>
      <p className="mt-1 text-gray-600">
        {answered
          ? "You've submitted. You can still tweak your answers until the other person finishes — then they lock and reveal."
          : "Answer at your own pace. Your answers stay private until you've both finished."}
      </p>

      <form action={submitResponse} className="mt-6 space-y-5">
        <input type="hidden" name="instance_id" value={instance.id} />
        <input type="hidden" name="connection_id" value={id} />

        {questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-gray-100 p-4">
            <label className="block font-medium" htmlFor={`q_${q.id}`}>
              {i + 1}. {q.text}
            </label>
            <Field question={q} defaultValue={myAnswers[q.id]} />
          </div>
        ))}

        <button
          type="submit"
          className="w-full rounded-md bg-brand-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {answered ? "Update my answers" : "Submit my answers"}
        </button>
      </form>
    </div>
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
    return (
      <input
        id={name}
        name={name}
        type="number"
        min={question.min ?? 1}
        max={question.max ?? 10}
        defaultValue={defaultValue}
        className="mt-2 w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    );
  }
  if (question.format === "choice" && question.options) {
    return (
      <div className="mt-2 space-y-1">
        {question.options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              value={opt}
              defaultChecked={defaultValue === opt}
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
      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
    />
  );
}
