"use client";

import { useEffect, useState } from "react";
import {
  GTM_ID,
  readStoredConsent,
  storeConsent,
  type ConsentChoice,
} from "@/lib/analytics";

// Withdrawing consent has to be as easy as giving it, so the privacy policy
// carries a live control rather than instructions to clear your browser.
function clearGaCookies() {
  try {
    const host = window.location.hostname;
    // _ga plus the per-property _ga_<STREAM_ID> cookie.
    const names = document.cookie
      .split(";")
      .map((c) => c.split("=")[0]?.trim())
      .filter((n): n is string => !!n && (n === "_ga" || n.startsWith("_ga_")));
    for (const name of names) {
      for (const domain of [host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`]) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
      }
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  } catch {
    // Best effort only.
  }
}

export default function ConsentPreferences() {
  const [choice, setChoice] = useState<ConsentChoice | null | "loading">(
    "loading",
  );

  useEffect(() => {
    setChoice(readStoredConsent());
  }, []);

  if (!GTM_ID) return null;

  function set(next: ConsentChoice) {
    storeConsent(next);
    setChoice(next);
    window.gtag?.("consent", "update", {
      analytics_storage: next === "granted" ? "granted" : "denied",
    });
    if (next === "denied") clearGaCookies();
  }

  const label =
    choice === "loading"
      ? "Checking your current choice…"
      : choice === "granted"
        ? "You currently allow analytics cookies on our public pages."
        : choice === "denied"
          ? "You currently decline analytics cookies."
          : "You haven't chosen yet — analytics cookies are off until you do.";

  return (
    <div className="mt-3 rounded-2xl border border-surface-line bg-surface p-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => set("denied")}
          disabled={choice === "loading" || choice === "denied"}
          className="rounded-full border border-surface-line px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-paper-warm hover:text-ink disabled:opacity-40"
        >
          Decline analytics
        </button>
        <button
          type="button"
          onClick={() => set("granted")}
          disabled={choice === "loading" || choice === "granted"}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800 disabled:opacity-40"
        >
          Allow analytics
        </button>
      </div>
    </div>
  );
}
