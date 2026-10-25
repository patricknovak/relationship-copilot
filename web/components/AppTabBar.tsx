"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/connections", label: "People", icon: "rings", match: (p) => p.startsWith("/connections") },
  { href: "/library", label: "Library", icon: "book", match: (p) => p.startsWith("/library") },
  { href: "/safety", label: "Safety", icon: "lifebuoy", match: (p) => p.startsWith("/safety") },
  { href: "/account", label: "Account", icon: "user", match: (p) => p.startsWith("/account") || p.startsWith("/onboarding") },
];

const APP_PREFIXES = ["/connections", "/account", "/onboarding", "/library", "/safety"];

// Thumb-reach navigation for the signed-in app on phones. Rendered only when
// the auth hint says a session exists (display-only; routes still verify) and
// only inside the app surface, so marketing pages keep their full-width feel.
export default function AppTabBar() {
  const pathname = usePathname();
  const inApp = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!inApp) return null;

  return (
    <nav
      aria-label="App navigation"
      className="auth-in"
    >
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-line bg-paper/85 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur-md sm:hidden">
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {TABS.map((t) => {
            const active = t.match(pathname);
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition ${
                    active
                      ? "text-brand-700 dark:text-brand-200"
                      : "text-ink-faint hover:text-ink"
                  }`}
                >
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition ${
                      active ? "bg-brand-100 dark:bg-brand-900/50" : ""
                    }`}
                  >
                    <Icon name={t.icon} className="h-5 w-5" strokeWidth={active ? 2.1 : 1.8} />
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {/* Keep the page's last content clear of the bar. */}
      <div className="h-20 sm:hidden" aria-hidden />
    </nav>
  );
}
