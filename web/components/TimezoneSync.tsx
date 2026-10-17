"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setConnectionTimezone } from "@/app/actions/connections";

// Connections created before time zones existed (or from a browser that
// couldn't report one) sit on UTC. The first member to open the hub from a
// browser that knows its zone adopts it, once, so the daily boundary stops
// flipping mid-afternoon. Renders nothing.
export default function TimezoneSync({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      return;
    }
    if (!tz || tz === "UTC" || tz === "Etc/UTC") return;
    setConnectionTimezone(connectionId, tz)
      .then((r) => {
        if (r?.updated) router.refresh();
      })
      .catch(() => {
        /* best effort */
      });
  }, [connectionId, router]);
  return null;
}
