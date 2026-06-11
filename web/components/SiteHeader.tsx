import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HeaderNav from "@/components/HeaderNav";

// Two overlapping rings — two people, one connection.
function LogoMark() {
  return (
    <svg
      viewBox="0 0 28 20"
      aria-hidden
      className="h-5 w-7 text-brand-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <circle cx="10" cy="10" r="7.5" />
      <circle cx="18" cy="10" r="7.5" className="text-brand-400" />
    </svg>
  );
}

export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100/70 bg-paper/80 backdrop-blur-md">
      <nav className="relative mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-base text-ink sm:text-lg"
        >
          <LogoMark />
          Relationship&nbsp;Copilot
        </Link>
        <HeaderNav signedIn={!!user} />
      </nav>
    </header>
  );
}
