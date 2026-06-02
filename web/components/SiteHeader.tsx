import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
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
          {user ? (
            <>
              <Link href="/connections" className="text-gray-700 hover:text-gray-900">
                Connections
              </Link>
              <Link href="/account" className="text-gray-700 hover:text-gray-900">
                Account
              </Link>
              <form action={signOut}>
                <button className="text-gray-500 hover:text-gray-700">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
