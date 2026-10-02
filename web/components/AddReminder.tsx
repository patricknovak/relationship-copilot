"use client";

import { useId, useState } from "react";
import { BOTH_JOINED, REMINDER_ICS } from "@/lib/firstRevealCopy";
import { buildReminderIcs, defaultReminderStart } from "@/lib/ics";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function fromDatetimeLocalValue(value: string): Date | null {
  // datetime-local is wall-clock local; Date parses it as local when given
  // as "YYYY-MM-DDTHH:mm" without a Z.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Builds a personal .ics reminder in the browser (Blob download). No server
// route, no analytics, no answer content. User can change date/time before
// download; calendar apps also let them edit after import.
export default function AddReminder({
  connectionUrl,
}: {
  connectionUrl: string;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(() =>
    toDatetimeLocalValue(defaultReminderStart()),
  );

  function download() {
    const start = fromDatetimeLocalValue(when) ?? defaultReminderStart();
    const ics = buildReminderIcs({
      title: REMINDER_ICS.title,
      description: REMINDER_ICS.description(connectionUrl),
      start,
      durationMinutes: 15,
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "relationship-copilot-reminder.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-ink-soft/80 underline hover:text-ink-soft"
      >
        {BOTH_JOINED.reminderLink}
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-2 text-sm text-ink-soft">
      <label htmlFor={inputId} className="block">
        Reminder time
      </label>
      <input
        id={inputId}
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="input"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={download} className="btn-secondary">
          Download calendar reminder
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ink-soft/70 underline hover:text-ink-soft"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-ink-soft/70">
        Defaults to tomorrow at 7:00 PM, for 15 minutes. Change it here or in
        your calendar. It&apos;s saved to your own calendar — we don&apos;t send
        reminders.
      </p>
    </div>
  );
}
