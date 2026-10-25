import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";

// Two overlapping rings — two people, one connection.
export function LogoMark({ className = "h-6 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 22" aria-hidden className={className} fill="none">
      <defs>
        <linearGradient id="rc-ring-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b4486" />
          <stop offset="100%" stopColor="#5f2f5b" />
        </linearGradient>
        <linearGradient id="rc-ring-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#bb7fb6" />
        </linearGradient>
      </defs>
      <circle cx="11" cy="11" r="8.2" stroke="url(#rc-ring-a)" strokeWidth="2.6" />
      <circle cx="21" cy="11" r="8.2" stroke="url(#rc-ring-b)" strokeWidth="2.6" />
    </svg>
  );
}

// No session read here: the root layout must not touch cookies, or no page
// could be prerendered. HeaderNav renders both nav variants and the auth hint
// (components/AuthHint.tsx) shows the right one before first paint.
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-surface-line/70 bg-paper/80 backdrop-blur-xl">
      <nav className="relative mx-auto flex h-16 max-w-5xl min-w-0 items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-full font-display text-base text-ink sm:text-lg"
        >
          <LogoMark />
          <span className="truncate tracking-tight">Relationship&nbsp;Copilot</span>
        </Link>
        <HeaderNav />
      </nav>
    </header>
  );
}
