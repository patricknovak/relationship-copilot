import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

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
      <nav className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg text-ink"
        >
          <LogoMark />
          Relationship&nbsp;Copilot
        </Link>
        <div className="flex items-center gap-1 text-sm sm:gap-2">
          {/* Safety must be reachable from every screen. */}
          <Link
            href="/safety"
            className="rounded-full px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-50"
          >
            Safety
          </Link>
          {user ? (
            <>
              <Link
                href="/connections"
                className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-brand-100/60 hover:text-ink"
              >
                Connections
              </Link>
              <Link
                href="/library"
                className="hidden rounded-full px-3 py-1.5 text-ink-soft hover:bg-brand-100/60 hover:text-ink sm:inline-block"
              >
                Library
              </Link>
              <Link
                href="/account"
                className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-brand-100/60 hover:text-ink"
              >
                Account
              </Link>
              <form action={signOut}>
                <button className="rounded-full px-3 py-1.5 text-ink-soft/70 hover:bg-brand-100/60 hover:text-ink">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/pricing"
                className="hidden rounded-full px-3 py-1.5 text-ink-soft hover:bg-brand-100/60 hover:text-ink sm:inline-block"
              >
                Pricing
              </Link>
              <Link href="/login" className="btn-primary !px-4 !py-2">
                Sign in
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
