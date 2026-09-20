"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { GTM_ID, isMeasurablePath } from "@/lib/analytics";

// Loads Google Tag Manager, but only while the visitor is on the public
// marketing surface. Deep-linking straight into the app (say, an invite link)
// never loads it at all.
//
// Once loaded the snippet stays in the document for the rest of the session,
// so the container carries the same boundary as a second line of defence: its
// GA4 tags fire on "Marketing Pages" triggers whose Page Path must not match
// ^/(connections|account|onboarding|auth|invite).
//
// There is deliberately no <noscript> iframe fallback — it would fire a
// pageview that cannot honour Consent Mode.
export default function Analytics() {
  const pathname = usePathname();

  if (!GTM_ID) return null;
  if (!isMeasurablePath(pathname)) return null;

  return (
    <Script id="gtm-loader" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  );
}
