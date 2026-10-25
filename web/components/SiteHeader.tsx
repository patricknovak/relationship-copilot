import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";
import { LogoMark } from "@/components/Brand";

// Two overlapping rings — two people, one connection.
export { LogoMark } from "@/components/Brand";

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
