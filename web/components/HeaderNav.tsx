"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { AuthSwitch } from "@/components/AuthHint";
import { forgetPushOnThisDevice } from "@/components/pushDevice";
import { Icon } from "@/components/ui/Icon";

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

// Client nav: full links on desktop, a slide-down panel on mobile. Both the
// signed-in and signed-out variants are rendered; the auth hint on <html>
// (components/AuthHint.tsx) shows one before first paint, so the header never
// reads cookies and every public page can be prerendered. signOut is a server
// action.
export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close the panel on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes the panel and hands focus back to the menu button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Signing out on a shared browser stops this device's notifications.
  const forgetPush = () => {
    void forgetPushOnThisDevice();
  };

  const linkCls = (href: string) =>
    `rounded-full px-3 py-1.5 text-sm transition ${
      pathname.startsWith(href)
        ? "bg-brand-100 font-semibold text-brand-900 dark:bg-brand-900/50 dark:text-brand-100"
        : "font-medium text-ink-soft hover:bg-surface-line/60 hover:text-ink"
    }`;

  const desktop = (links: typeof SIGNED_IN_LINKS) =>
    links.map((l) => (
      <Link
        key={l.href}
        href={l.href}
        aria-current={pathname.startsWith(l.href) ? "page" : undefined}
        className={linkCls(l.href)}
      >
        {l.label}
      </Link>
    ));

  const mobile = (links: typeof SIGNED_IN_LINKS) =>
    links.map((l) => (
      <Link
        key={l.href}
        href={l.href}
        onClick={() => setOpen(false)}
        aria-current={pathname.startsWith(l.href) ? "page" : undefined}
        className={`flex items-center justify-between rounded-xl px-3 py-3 text-base ${
          pathname.startsWith(l.href)
            ? "bg-brand-100 font-semibold text-brand-900 dark:bg-brand-900/50 dark:text-brand-100"
            : "text-ink hover:bg-surface-line/60"
        }`}
      >
        {l.label}
        <Icon name="chevron-right" className="h-4 w-4 text-ink-faint" />
      </Link>
    ));

  return (
    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
      {/* Safety must be reachable from every screen, at every width. */}
      <Link
        href="/safety"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 sm:px-3 dark:text-rose-300 dark:hover:bg-rose-950/40"
      >
        <Icon name="lifebuoy" className="h-4 w-4" />
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
                <button className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-faint transition hover:bg-surface-line/60 hover:text-ink">
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
        ref={menuButtonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="btn-icon sm:hidden"
      >
        <Icon name={open ? "x" : "menu"} className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* Mobile panel */}
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-surface-line bg-paper/95 shadow-float backdrop-blur-xl sm:hidden">
          <div className="mx-auto max-w-5xl space-y-1 px-4 py-4">
            <AuthSwitch
              signedIn={
                <>
                  {mobile(SIGNED_IN_LINKS)}
                  <form
                    action={signOut}
                    onSubmit={forgetPush}
                    className="hairline pt-2"
                  >
                    <button className="block w-full rounded-xl px-3 py-3 text-left text-base text-ink-soft hover:bg-surface-line/60">
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
                    className="btn-primary mt-2 w-full !py-3"
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
