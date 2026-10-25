"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

// Sun/moon toggle. Reads the class set by ThemeScript, persists the choice to
// localStorage. Renders a stable placeholder until mounted to avoid hydration
// mismatch (the real icon depends on a client-only value).
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage may be unavailable; the toggle still works for the session */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={mounted && dark ? "Switch to light mode" : "Switch to dark mode"}
      className="btn-icon"
    >
      <Icon name={mounted && dark ? "sun" : "moon"} className="h-[18px] w-[18px]" />
    </button>
  );
}
