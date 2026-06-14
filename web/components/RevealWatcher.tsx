"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
            setTimeout(() => setCelebrate(false), 2600);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId, router]);

  if (!celebrate) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="animate-fade-up rounded-3xl bg-brand-900/95 px-8 py-6 text-center shadow-lift">
        <div className="flex justify-center gap-2 text-2xl">
          {["✨", "💜", "✨"].map((e, i) => (
            <span
              key={i}
              className="animate-fade-up inline-block"
              style={{ animationDelay: `${i * 140}ms` }}
            >
              {e}
            </span>
          ))}
        </div>
        <p className="mt-2 font-display text-2xl text-white">Revealed!</p>
        <p className="mt-1 text-sm text-brand-100">
          You both answered — scroll down to see each other&apos;s words.
        </p>
      </div>
    </div>
  );
}
