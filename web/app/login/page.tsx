"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-1 text-sm text-gray-600">
        We&apos;ll email you a secure link — no password needed.
      </p>

      {sent ? (
        <div className="mt-6 rounded-md bg-brand-50 p-4 text-sm text-brand-700">
          Check your inbox for a sign-in link.
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Email me a link"}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>
      )}

      <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" /> or{" "}
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
      >
        Continue with Google
      </button>
    </div>
  );
}
