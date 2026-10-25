"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

// The signature moment, as a living demo on the landing page: the other
// person's answer stays blurred until you "share" yours, then both unblur.
// Purely cosmetic — no data, no network.
export default function RevealDemo() {
  const [stage, setStage] = useState<"idle" | "typing" | "revealed">("idle");

  // Auto-play once so a visitor who never touches it still sees the reveal.
  useEffect(() => {
    const t1 = setTimeout(() => setStage("typing"), 900);
    const t2 = setTimeout(() => setStage("revealed"), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const revealed = stage === "revealed";

  return (
    <div className="card-hero text-left">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Today&apos;s question</p>
        <span className="pill-quiet">
          <Icon name="lock" className="h-3 w-3" />
          {revealed ? "Revealed together" : "Private until you both share"}
        </span>
      </div>
      <p className="mt-2 font-display text-xl text-ink sm:text-2xl">
        &ldquo;When do you feel most appreciated by me?&rdquo;
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="answer-you">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
            <Avatar name="You" size="xs" variant="you" ring={false} />
            You
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {stage === "idle" ? (
              <span className="text-ink-faint">Write what&apos;s true for you…</span>
            ) : (
              <>
                When you notice the small stuff — like Tuesday, when you just said
                &ldquo;I saw how hard that was.&rdquo;
              </>
            )}
          </p>
        </div>

        <div className="answer-them relative overflow-hidden">
          <p className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
            <Avatar name="Alex" size="xs" variant="them" ring={false} />
            Alex
          </p>
          <p
            aria-hidden={!revealed}
            className={`mt-2 text-sm leading-relaxed text-ink transition-all duration-700 ${
              revealed ? "animate-unblur" : "select-none blur-[7px] opacity-60"
            }`}
          >
            Honestly, it&apos;s the mornings. You always remember the little rituals
            that make us, us.
          </p>
          {!revealed && (
            <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-accent-50/90 via-accent-50/30 to-transparent p-3 dark:from-surface dark:via-surface/40">
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-paper">
                Reveals when you both answer
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">
          {revealed ? "Both answers unlocked at the same moment." : "Neither of you can peek early."}
        </p>
        {revealed ? (
          <button
            type="button"
            onClick={() => {
              setStage("idle");
              setTimeout(() => setStage("typing"), 500);
              setTimeout(() => setStage("revealed"), 1800);
            }}
            className="btn-ghost btn-sm"
          >
            Replay
          </button>
        ) : (
          <button type="button" onClick={() => setStage("revealed")} className="btn-primary btn-sm">
            Share when ready
          </button>
        )}
      </div>
    </div>
  );
}
