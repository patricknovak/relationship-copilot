import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";

// Two overlapping rings — two people, one connection.
function LogoMark() {
  return (
    <svg
      viewBox="0 0 28 20"
      aria-hidden
      className="h-5 w-7 text-brand-700 dark:text-brand-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <circle cx="10" cy="10" r="7.5" />
      <circle cx="18" cy="10" r="7.5" className="text-brand-400" />
    </svg>
  );
}

// No session read here: the root layout must not touch cookies, or no page
// could be prerendered. HeaderNav renders both nav variants and the auth hint
// (components/AuthHint.tsx) shows the right one before first paint.
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-100/70 dark:border-surface-line bg-paper/80 backdrop-blur-md">
      <nav className="relative mx-auto flex h-16 max-w-5xl min-w-0 items-center justify-between gap-2 px-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 font-display text-sm text-ink sm:text-lg"
        >
          <LogoMark />
          <span className="truncate">Relationship&nbsp;Copilot</span>
        </Link>
        <HeaderNav />
      </nav>
    </header>
  );
}
