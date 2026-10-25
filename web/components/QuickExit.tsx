"use client";

import { useEffect } from "react";

const EXIT_URL = "https://www.google.com/search?q=weather";

// Safety affordance for people who may be browsing under observation: one
// click (or Escape) immediately swaps this page for an innocuous one.
// location.replace removes the current page from the back button; earlier
// history may remain, so the page also advises private browsing.
function exitNow() {
  window.location.replace(EXIT_URL);
}

export default function QuickExit() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") exitNow();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      onClick={exitNow}
      aria-label="Quick exit (Esc): leave this page now"
      className="fixed right-4 top-20 z-50 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-float transition hover:scale-[1.03] active:scale-[0.98] dark:bg-paper dark:text-ink"
    >
      Quick exit (Esc)
    </button>
  );
}
