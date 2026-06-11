"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/redirect";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Carry the post-login destination (set by the auth middleware) through the
  // magic link / OAuth round-trip. Validated here and again in the callback.
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          safeNextPath(new URLSearchParams(window.location.search).get("next")),
        )}`
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
    <div className="hero-glow">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="card !rounded-3xl !p-8 shadow-lift animate-fade-up">
          <h1 className="text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm text-ink-soft">
            We&apos;ll email you a secure link — no password needed.
          </p>

          {sent ? (
            <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
              Check your inbox for a sign-in link. ✨
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="mt-6 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-60"
              >
                {loading ? "Sending…" : "Email me a link"}
              </button>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </form>
          )}

          <div className="my-6 flex items-center gap-3 text-xs text-ink-soft/60">
            <span className="h-px flex-1 bg-brand-200/70" /> or{" "}
            <span className="h-px flex-1 bg-brand-200/70" />
          </div>

          <button onClick={signInWithGoogle} className="btn-secondary w-full">
            Continue with Google
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-ink-soft/70">
          New here? Signing in creates your free account.
        </p>
      </div>
    </div>
  );
}
