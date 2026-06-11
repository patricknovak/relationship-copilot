import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />

        <main className="flex-1">{children}</main>

        <footer className="border-t border-gray-100 text-xs text-gray-500">
          <div className="mx-auto max-w-5xl px-4 py-6 space-y-1">
            <p>
              Relationship Copilot offers relationship wellness and
              coaching-style guidance. It is not therapy, medical, or
              diagnostic advice.
            </p>
            <p>
              In crisis?{" "}
              <Link href="/safety" className="underline">
                Find immediate support
              </Link>
              .
            </p>
            <p>
              <Link href="/privacy" className="underline">
                Privacy
              </Link>{" "}
              ·{" "}
              <Link href="/terms" className="underline">
                Terms
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
