import type { Metadata } from "next";
import Link from "next/link";
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
        <header className="border-b border-gray-100">
          <nav className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold text-brand-700">
              Relationship&nbsp;Copilot
            </Link>
            <div className="flex items-center gap-4 text-sm">
              {/* Safety must be reachable from every screen. */}
              <Link
                href="/safety"
                className="text-rose-700 hover:text-rose-800 font-medium"
              >
                Safety
              </Link>
              <Link
                href="/login"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
              >
                Sign in
              </Link>
            </div>
          </nav>
        </header>

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
          </div>
        </footer>
      </body>
    </html>
  );
}
