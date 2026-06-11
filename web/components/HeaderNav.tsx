"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

// Client nav: full links on desktop, hamburger panel on mobile. Auth state
// arrives as a prop from the server header; signOut is a server action.
export default function HeaderNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const links = signedIn
    ? [
        { href: "/connections", label: "Connections" },
        { href: "/library", label: "Library" },
        { href: "/account", label: "Account" },
      ]
    : [
        { href: "/pricing", label: "Pricing" },
        { href: "/library", label: "Library" },
      ];

  const linkCls = (href: string) =>
    `rounded-full px-3 py-1.5 transition ${
      pathname.startsWith(href)
        ? "bg-brand-100 text-ink font-medium"
        : "text-ink-soft hover:bg-brand-100/60 hover:text-ink"
    }`;

  return (
    <div className="flex items-center gap-1 text-sm sm:gap-2">
      {/* Safety must be reachable from every screen, at every width. */}
      <Link
        href="/safety"
        className="rounded-full px-2 py-1.5 font-medium text-rose-700 hover:bg-rose-50 sm:px-3"
      >
        Safety
      </Link>

      {/* Desktop links */}
      <div className="hidden items-center gap-1 sm:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={linkCls(l.href)}>
            {l.label}
          </Link>
        ))}
        {signedIn ? (
          <form action={signOut}>
            <button className="rounded-full px-3 py-1.5 text-ink-soft/70 hover:bg-brand-100/60 hover:text-ink">
              Sign out
            </button>
          </form>
        ) : (
          <Link href="/login" className="btn-primary !px-4 !py-2">
            Sign in
          </Link>
        )}
      </div>

      {/* Mobile: primary CTA + hamburger */}
      {!signedIn && (
        <Link
          href="/login"
          className="btn-primary whitespace-nowrap !px-3.5 !py-1.5 sm:hidden"
        >
          Sign in
        </Link>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-brand-100/60 sm:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {/* Mobile panel */}
      {open && (
        <div className="absolute inset-x-0 top-16 z-50 border-b border-brand-100 bg-paper shadow-lift sm:hidden">
          <div className="mx-auto max-w-5xl space-y-1 px-4 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-base text-ink hover:bg-brand-100/60"
              >
                {l.label}
              </Link>
            ))}
            {signedIn && (
              <form action={signOut} className="border-t border-brand-100/70 pt-2">
                <button className="block w-full rounded-xl px-3 py-2.5 text-left text-base text-ink-soft hover:bg-brand-100/60">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
