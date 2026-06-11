import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
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
  title: "Relationship Copilot",
  description:
    "Build deeper, healthier connections with the people who matter — across the whole arc of a relationship.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <SiteHeader />

        <main className="flex-1">{children}</main>

        <footer className="mt-16 bg-ink text-brand-100/80">
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
