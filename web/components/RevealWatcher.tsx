"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Live updates: refresh the page when the instance reveals (status change) or a
// new discussion message arrives. RLS still governs what the refreshed render
// can read, so this never leaks a partner's answer early.
export default function RevealWatcher({ instanceId }: { instanceId: string }) {
  const router = useRouter();

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
        () => router.refresh(),
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

  return null;
}
