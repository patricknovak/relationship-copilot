"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reactToAnswer } from "@/app/actions/prompts";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";

// One-tap reaction picker under the other person's revealed answer. Tapping
// the current reaction removes it; tapping another replaces it. Optimistic so
// it feels instant; the server action re-validates under RLS.
export default function ReactionBar({
  instanceId,
  connectionId,
  targetUserId,
  questionId,
  mine,
}: {
  instanceId: string;
  connectionId: string;
  targetUserId: string;
  questionId: string;
  mine: ReactionEmoji | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic<ReactionEmoji | null, ReactionEmoji | null>(
    mine,
    (_, next) => next,
  );

  function tap(emoji: ReactionEmoji) {
    const next = optimistic === emoji ? null : emoji;
    startTransition(async () => {
      setOptimistic(next);
      await reactToAnswer({ instanceId, connectionId, targetUserId, questionId, emoji: next });
      router.refresh();
    });
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="React to this answer">
      {REACTION_EMOJIS.map((e) => {
        const active = optimistic === e;
        return (
          <button
            key={e}
            type="button"
            onClick={() => tap(e)}
            disabled={pending}
            aria-pressed={active}
            aria-label={`React ${e}`}
            className={`h-9 min-w-9 rounded-full border px-2 text-base leading-none transition hover:-translate-y-0.5 active:scale-95 ${
              active
                ? "scale-110 border-brand-700 bg-brand-700/10 shadow-soft dark:border-brand-400 dark:bg-brand-500/20"
                : "border-surface-line bg-white/80 hover:border-brand-400 dark:bg-surface"
            } disabled:opacity-70`}
          >
            {e}
          </button>
        );
      })}
    </div>
  );
}
