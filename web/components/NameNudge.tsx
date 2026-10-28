"use client";

import { useState, useTransition } from "react";
import { saveDisplayNameInline } from "@/app/actions/profile";
import { Icon } from "@/components/ui/Icon";

// People who join from an invite land straight on the questions, before they
// have told us their name, so their person would see "Them" in the reveal.
// One field fixes it, saved in place so nothing typed below is lost.
export default function NameNudge({ suggested }: { suggested: string }) {
  const [name, setName] = useState(suggested);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (saved) {
    return (
      <p
        role="status"
        className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        <Icon name="check" className="h-4 w-4" strokeWidth={2.4} />
        Thanks, {saved}. That&apos;s the name your person will see.
      </p>
    );
  }

  return (
    <form
      className="card-tint mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveDisplayNameInline(name);
          if (res.error) setError(res.error);
          else setSaved(res.name ?? name.trim());
        });
      }}
    >
      <label htmlFor="name-nudge" className="block font-display text-lg text-ink">
        First, what should we call you?
      </label>
      <p className="mt-0.5 text-sm text-ink-soft">
        Your person sees this name next to your answers.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          id="name-nudge"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          autoComplete="given-name"
          placeholder="Your name"
          className="input flex-1"
        />
        <button type="submit" disabled={pending} className="btn-primary shrink-0 disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}
    </form>
  );
}
