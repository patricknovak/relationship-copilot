"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitResponse } from "@/app/actions/prompts";
import { MICROCOPY } from "@/lib/firstRevealCopy";
import SafetySupport from "@/components/SafetySupport";
import type { PromptQuestion } from "@/lib/database.types";
import { Icon } from "@/components/ui/Icon";

type AnswerMap = Record<string, string>;

// The answering side of a prompt instance. Client-side because the stakes
// warrant it: answers draft to localStorage as you type (nothing is lost to a
// closed tab, an error, or the reveal refreshing the page), progress is
// visible, submit is disabled until every question has an answer (a blank
// submit would otherwise waste the one-time reveal), and errors render inline
// instead of unmounting the form.
export default function AnswerForm({
  instanceId,
  connectionId,
  userId,
  questions,
  initialAnswers,
  answered,
}: {
  instanceId: string;
  connectionId: string;
  userId: string;
  questions: PromptQuestion[];
  initialAnswers: AnswerMap;
  answered: boolean;
}) {
  const draftKey = `rc-draft-${instanceId}-${userId}`;
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [support, setSupport] = useState<"high" | "elevated" | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const hydrated = useRef(false);

  // Restore any local draft on mount (drafts are newer than server state).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as AnswerMap;
        if (draft && typeof draft === "object" && Object.keys(draft).length) {
          setAnswers((prev) => ({ ...prev, ...draft }));
          setRestoredDraft(true);
        }
      }
    } catch {
      /* corrupt or unavailable storage — start from server state */
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft every change.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(answers));
    } catch {
      /* storage full/unavailable — typing still works, just no draft */
    }
  }, [answers, draftKey]);

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length,
    [questions, answers],
  );
  const complete = answeredCount === questions.length;

  function setAnswer(id: string, value: string) {
    setSaved(false);
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitResponse({ instanceId, connectionId, answers });
      if (result?.error) {
        setError(result.error);
        return;
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      if (result?.safety) setSupport("high");
      else if (result?.gentle) setSupport("elevated");
      setSaved(true);
      router.refresh();
    });
  }

  const pct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      {restoredDraft && !answered && (
        <p className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-2.5 text-sm text-brand-800 dark:border-brand-800/60 dark:bg-brand-900/20 dark:text-brand-200">
          <Icon name="history" className="h-4 w-4 shrink-0" />
          Picked up where you left off — your unsent draft was restored.
        </p>
      )}

      {support && <SafetySupport level={support} />}

      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Icon name="eye-off" className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
        {MICROCOPY.aboveQuestion}
      </p>

      {questions.map((q, i) => {
        const done = (answers[q.id] ?? "").trim() !== "";
        return (
          <div key={q.id} className={`card transition ${done ? "border-brand-200 dark:border-brand-800/60" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">
                Question {i + 1} of {questions.length}
              </p>
              <span
                aria-hidden
                className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
                  done ? "bg-brand-700 text-white dark:bg-brand-500" : "border border-surface-line text-transparent"
                }`}
              >
                <Icon name="check" className="h-3 w-3" strokeWidth={3} />
              </span>
            </div>
            <label
              className="mt-1.5 block font-display text-xl leading-snug text-ink"
              htmlFor={`q_${q.id}`}
            >
              {q.text}
            </label>
            <Field
              question={q}
              value={answers[q.id] ?? ""}
              onChange={(v) => setAnswer(q.id, v)}
            />
            <p className="mt-2 flex items-center gap-1 text-xs text-ink-faint">
              <Icon name="lock" className="h-3 w-3" />
              {MICROCOPY.belowQuestion}
            </p>
          </div>
        );
      })}

      <div className="sticky bottom-3 z-10 rounded-2xl border border-surface-line bg-surface/95 p-3 shadow-float backdrop-blur sm:bottom-4">
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        {saved && !error && (
          <p className="mb-2 flex items-center gap-1.5 text-sm text-brand-700 dark:text-brand-300">
            <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
            {MICROCOPY.confirmOnSubmit}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-soft" aria-live="polite">
              <span className="font-semibold text-ink">{answeredCount}</span> of {questions.length} answered
            </p>
            <div className="progress-track mt-1.5" aria-hidden>
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <button
            type="submit"
            disabled={pending || !complete}
            className="btn-primary !px-6 !py-2.5 disabled:opacity-50"
            title={complete ? undefined : "Answer every question to submit"}
          >
            {pending
              ? "Saving…"
              : answered
                ? MICROCOPY.updateSubmit
                : MICROCOPY.submit}
            {!pending && <Icon name="arrow-right" className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  question,
  value,
  onChange,
}: {
  question: PromptQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const name = `q_${question.id}`;
  if (question.format === "scale") {
    const min = question.min ?? 1;
    const max = question.max ?? 10;
    const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={question.text}>
        {values.map((n) => (
          <label
            key={n}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-surface-line bg-surface text-sm font-medium text-ink-soft shadow-soft transition hover:-translate-y-0.5 hover:border-brand-400 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-700 has-[:checked]:font-semibold has-[:checked]:text-white has-[:checked]:shadow-brand-glow has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/60 has-[:focus-visible]:ring-offset-2 dark:has-[:checked]:bg-brand-500"
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === String(n)}
              onChange={() => onChange(String(n))}
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
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={question.text}>
        {question.options.map((opt) => (
          <label
            key={opt}
            className="cursor-pointer rounded-full border border-surface-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft shadow-soft transition hover:-translate-y-0.5 hover:border-brand-400 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-700 has-[:checked]:text-white has-[:checked]:shadow-brand-glow has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/60 has-[:focus-visible]:ring-offset-2 dark:has-[:checked]:bg-brand-500"
          >
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
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
      rows={4}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write what's true for you…"
      className="input mt-3 min-h-28 text-base leading-relaxed"
    />
  );
}
