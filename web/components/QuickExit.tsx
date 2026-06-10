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
      aria-label="Quickly leave this page"
      className="fixed right-4 top-4 z-50 rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-white shadow hover:bg-gray-900"
    >
      Quick exit (Esc)
    </button>
  );
}
