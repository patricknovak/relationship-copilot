"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import {
  CONSENT_CHANGE_EVENT,
  GTM_ID,
  readStoredConsent,
  shouldLoadGtm,
  type ConsentChoice,
} from "@/lib/analytics";

// Loads Google Tag Manager only after the visitor has granted analytics
// consent, and only on the public marketing surface.
//
// We intentionally do NOT use Consent Mode "advanced" (load tags while
// denied). That mode still sends cookieless page_view hits to Google, which
// contradicts the privacy policy ("if you decline, nothing is stored or
// sent"). Defaults stay denied in ConsentDefaults; this component simply
// never injects gtm.js until Accept.
//
// On Accept in the same page view, CookieConsent stores consent, updates
// gtag consent, and dispatches CONSENT_CHANGE_EVENT so we mount the loader
// without a reload. Returning visitors with stored "granted" load GTM on
// first paint of public pages.
export default function Analytics({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentChoice | null | "loading">(
    "loading",
  );

  useEffect(() => {
    setConsent(readStoredConsent());
    const onChange = () => setConsent(readStoredConsent());
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  }, []);

  if (!GTM_ID) return null;
  if (consent === "loading") return null;
  if (!shouldLoadGtm(pathname, consent)) return null;

  return (
    <Script id="gtm-loader" strategy="afterInteractive" nonce={nonce}>
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  );
}
