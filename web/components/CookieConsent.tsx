"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GTM_ID,
  readStoredConsent,
  shouldPromptForConsent,
  storeConsent,
  type ConsentChoice,
} from "@/lib/analytics";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Consent banner for analytics cookies.
//
// Notes on the choices here:
//  - Accept and Decline carry equal visual weight; a pre-ticked or hard-to-
//    find refusal isn't valid consent under GDPR.
//  - It's a bottom bar, not a modal. Nothing is blocked while it's up, which
//    matters on a site where someone may be looking for crisis resources.
//  - No Escape-key handler: /safety binds Escape to Quick Exit and that must
//    keep working untouched.
//  - When visible, body gets padding-bottom matching the banner height so
//    fixed-overlap doesn't cover login errors or page footers. /safety never
//    prompts, so Quick Exit is unaffected.
export default function CookieConsent() {
  const pathname = usePathname();
  const bannerRef = useRef<HTMLDivElement>(null);
  const [decided, setDecided] = useState<ConsentChoice | null | "loading">(
    "loading",
  );

  useEffect(() => {
    setDecided(readStoredConsent());
  }, []);

  const show =
    !!GTM_ID &&
    decided !== "loading" &&
    decided === null &&
    shouldPromptForConsent(pathname);

  // Push page content clear of the fixed banner without needing server-side
  // GTM/consent state. Cleared on dismiss or when the banner unmounts.
  useEffect(() => {
    if (!show) return;
    const el = bannerRef.current;
    if (!el) return;

    const apply = () => {
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, [show]);

  function choose(choice: ConsentChoice) {
    storeConsent(choice);
    setDecided(choice);
    if (choice === "granted") {
      // Only analytics. Advertising signals stay denied permanently.
      window.gtag?.("consent", "update", { analytics_storage: "granted" });
    }
  }

  if (!show) return null;

  const compact = pathname === "/login" || pathname.startsWith("/login/");

  return (
    <div
      ref={bannerRef}
      role="region"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4"
    >
      <div
        className={`mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-surface-line bg-surface shadow-lift sm:flex-row sm:items-center sm:gap-4 ${
          compact ? "p-3" : "p-4"
        }`}
      >
        <p
          className={`flex-1 leading-relaxed text-ink-soft ${
            compact ? "text-xs sm:text-sm" : "text-sm"
          }`}
        >
          We&apos;d like to use Google Analytics to understand how people find
          these public pages. Nothing you write inside a connection is ever
          measured, and we don&apos;t use advertising cookies.{" "}
          <Link href="/privacy" className="underline hover:text-ink">
            Read our privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className={`rounded-full border border-surface-line font-medium text-ink-soft transition hover:bg-paper-warm hover:text-ink ${
              compact ? "px-3 py-1.5 text-xs sm:text-sm" : "px-4 py-2 text-sm"
            }`}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className={`rounded-full bg-brand-700 font-medium text-white transition hover:bg-brand-800 ${
              compact ? "px-3 py-1.5 text-xs sm:text-sm" : "px-4 py-2 text-sm"
            }`}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
