"use client";

import { useEffect, useState } from "react";

// Hidden input carrying the browser's IANA time zone, so a new connection's
// "day" boundary follows the person creating it instead of UTC. Server
// validates; an empty or unknown value falls back to UTC.
export default function TimezoneField() {
  const [tz, setTz] = useState("");
  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    } catch {
      /* leave empty → UTC */
    }
  }, []);
  return <input type="hidden" name="timezone" value={tz} readOnly />;
}
