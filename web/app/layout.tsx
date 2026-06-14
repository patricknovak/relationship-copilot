import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import ThemeScript from "@/components/ThemeScript";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT", "WONK"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://relationshipcopilot.com",
  ),
  title: {
    default: "Relationship Copilot — Closer, on purpose.",
    template: "%s — Relationship Copilot",
  },
  description:
    "Answer thoughtful questions together and see each other's answers only when you've both shared — for partners, friends, family, and coworkers, across the whole arc of a relationship.",
  openGraph: {
    type: "website",
    siteName: "Relationship Copilot",
    title: "Relationship Copilot — Closer, on purpose.",
    description:
      "Answer together. Reveal together. Grow together — for every relationship that matters.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        <SiteHeader />

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="mt-16 border-t border-brand-900/40 bg-[#1c151c] text-brand-100/80">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <div className="grid gap-10 sm:grid-cols-3">
              <div>
                <p className="font-display text-lg text-white">
                  Relationship&nbsp;Copilot
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  Closer, on purpose — for partners, friends, family, and
                  coworkers, across the whole arc of a relationship.
                </p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-white">Explore</p>
                <ul className="mt-2 space-y-1.5">
                  <li>
                    <Link href="/library" className="hover:text-white">
                      Library
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="hover:text-white">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="hover:text-white">
                      Privacy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-white">
                      Terms
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="text-sm">
                <p className="font-medium text-white">Here for you</p>
                <p className="mt-2 leading-relaxed">
                  Relationship Copilot offers relationship wellness and
                  coaching-style guidance. It is not therapy, medical, or
                  diagnostic advice.
                </p>
                <p className="mt-3">
                  In crisis?{" "}
                  <Link
                    href="/safety"
                    className="font-medium text-rose-300 underline decoration-rose-300/50 underline-offset-2 hover:text-rose-200"
                  >
                    Find immediate support
                  </Link>
                  {" "}— always free.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
