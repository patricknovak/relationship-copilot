"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { AuthSwitch } from "@/components/AuthHint";
import { forgetPushOnThisDevice } from "@/components/pushDevice";

const SIGNED_IN_LINKS = [
  { href: "/connections", label: "Connections" },
  { href: "/library", label: "Library" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/account", label: "Account" },
];
const SIGNED_OUT_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/library", label: "Library" },
  { href: "/about", label: "About" },
];

// Client nav: full links on desktop, hamburger panel on mobile. Both the
// signed-in and signed-out variants are rendered; the auth hint on <html>
// (components/AuthHint.tsx) shows one before first paint, so the header never
// reads cookies and every public page can be prerendered. signOut is a server
// action.
export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Signing out on a shared browser stops this device's notifications.
  const forgetPush = () => {
    void forgetPushOnThisDevice();
  };

  const linkCls = (href: string) =>
    `rounded-full px-3 py-1.5 transition ${
      pathname.startsWith(href)
        ? "bg-brand-100 dark:bg-brand-900/40 text-ink font-medium"
        : "text-ink-soft hover:bg-surface-line/60 hover:text-ink"
    }`;

  const desktop = (links: typeof SIGNED_IN_LINKS) =>
    links.map((l) => (
      <Link key={l.href} href={l.href} className={linkCls(l.href)}>
        {l.label}
      </Link>
    ));

  const mobile = (links: typeof SIGNED_IN_LINKS) =>
    links.map((l) => (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => setOpen(false)}
        className="block rounded-xl px-3 py-2.5 text-base text-ink hover:bg-surface-line/60"
      >
        {l.label}
      </Link>
    ));

  return (
    <div className="flex shrink-0 items-center gap-0.5 text-sm sm:gap-2">
      {/* Safety must be reachable from every screen, at every width. */}
      <Link
        href="/safety"
        className="rounded-full px-2 py-1.5 font-medium text-rose-700 hover:bg-rose-50 sm:px-3 dark:text-rose-300 dark:hover:bg-rose-950/40"
      >
        Safety
      </Link>

      <ThemeToggle />

      {/* Desktop links */}
      <div className="hidden items-center gap-1 sm:flex">
        <AuthSwitch
          signedIn={
            <>
              {desktop(SIGNED_IN_LINKS)}
              <form action={signOut} onSubmit={forgetPush}>
                <button className="rounded-full px-3 py-1.5 text-ink-soft/70 hover:bg-surface-line/60 hover:text-ink">
                  Sign out
                </button>
              </form>
            </>
          }
          signedOut={
            <>
              {desktop(SIGNED_OUT_LINKS)}
              <Link href="/login" className="btn-primary !px-4 !py-2">
                Sign in
              </Link>
            </>
          }
        />
      </div>

      {/* Mobile: hamburger only — Sign in lives in the panel so the sticky
          bar never forces horizontal page scroll at ~360–390px. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-line/60 sm:hidden"
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
        <div className="absolute inset-x-0 top-16 z-50 border-b border-brand-100 dark:border-surface-line bg-paper shadow-lift sm:hidden">
          <div className="mx-auto max-w-5xl space-y-1 px-4 py-4">
            <AuthSwitch
              signedIn={
                <>
                  {mobile(SIGNED_IN_LINKS)}
                  <form
                    action={signOut}
                    onSubmit={forgetPush}
                    className="border-t border-brand-100/70 dark:border-surface-line pt-2"
                  >
                    <button className="block w-full rounded-xl px-3 py-2.5 text-left text-base text-ink-soft hover:bg-surface-line/60">
                      Sign out
                    </button>
                  </form>
                </>
              }
              signedOut={
                <>
                  {mobile(SIGNED_OUT_LINKS)}
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="btn-primary mt-1 w-full !px-3 !py-2.5"
                  >
                    Sign in
                  </Link>
                </>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
