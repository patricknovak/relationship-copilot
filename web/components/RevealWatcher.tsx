"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";

// Live updates: refresh the page when the instance reveals (status change) or a
// new discussion message arrives. RLS still governs what the refreshed render
// can read, so this never leaks a partner's answer early. When the reveal
// flips live, we mark the moment with a brief celebration overlay.
export default function RevealWatcher({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`instance:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "prompt_instances",
          filter: `id=eq.${instanceId}`,
        },
        (payload) => {
          const status = (payload.new as { status?: string } | null)?.status;
          if (status === "revealed") {
            setCelebrate(true);
            setTimeout(() => setCelebrate(false), 3200);
          }
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "prompt_discussions",
          filter: `instance_id=eq.${instanceId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "answer_reactions",
          filter: `instance_id=eq.${instanceId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    // Realtime events missed while the tab was asleep are never replayed, so
    // re-sync whenever the user comes back — otherwise a phone that dozed
    // through the reveal keeps showing the answer form.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [instanceId, router]);

  if (!celebrate) return null;

  const pieces = Array.from({ length: 18 }, (_, i) => i);
  const colors = ["#a25d9d", "#fb923c", "#d4add1", "#fdba74", "#74386f", "#fff"];

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
    >
      {pieces.map((i) => (
        <span
          key={i}
          aria-hidden
          className="absolute top-0 block h-2.5 w-1.5 animate-confetti rounded-sm"
          style={{
            left: `${(i * 53) % 100}%`,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 6) * 120}ms`,
            animationDuration: `${2200 + (i % 5) * 260}ms`,
          }}
        />
      ))}
      <div className="animate-pop rounded-3xl bg-brand-900/95 px-8 py-7 text-center shadow-float">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-accent-300">
          <Icon name="sparkles" className="h-6 w-6" />
        </span>
        <p className="mt-3 font-display text-3xl text-white">Revealed!</p>
        <p className="mt-1 text-sm text-brand-100">
          You both answered — scroll down to see each other&apos;s words.
        </p>
      </div>
    </div>
  );
}
