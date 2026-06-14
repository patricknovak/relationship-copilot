"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/redirect";

type OAuthProvider = "google" | "apple" | "facebook";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

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

  // One account either way: Supabase creates the account on first sign-in,
  // so these buttons cover both sign-up and sign-in.
  async function signInWith(provider: OAuthProvider) {
    setError(null);
    setOauthLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setOauthLoading(null);
      setError(
        error.message.toLowerCase().includes("not enabled")
          ? `Sign-in with ${provider[0].toUpperCase()}${provider.slice(1)} isn't available yet — try email or another provider.`
          : error.message,
      );
    }
    // On success the browser navigates away; keep the spinner until then.
  }

  return (
    <div className="hero-glow">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="card !rounded-3xl !p-8 shadow-lift animate-fade-up">
          <h1 className="text-3xl">Welcome</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Sign in or create your free account — same door for both.
          </p>

          <div className="mt-6 space-y-2.5">
            <button
              onClick={() => signInWith("google")}
              disabled={oauthLoading !== null}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-brand-200/80 bg-white px-5 py-2.5 text-sm font-medium text-[#1f1f1f] shadow-soft transition hover:bg-gray-50 disabled:opacity-60"
            >
              <GoogleIcon />
              {oauthLoading === "google" ? "Connecting…" : "Continue with Google"}
            </button>
            <button
              onClick={() => signInWith("apple")}
              disabled={oauthLoading !== null}
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-gray-900 disabled:opacity-60"
            >
              <AppleIcon />
              {oauthLoading === "apple" ? "Connecting…" : "Continue with Apple"}
            </button>
            <button
              onClick={() => signInWith("facebook")}
              disabled={oauthLoading !== null}
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-[#1877F2] px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-[#0f6ae0] disabled:opacity-60"
            >
              <FacebookIcon />
              {oauthLoading === "facebook"
                ? "Connecting…"
                : "Continue with Facebook"}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-soft/60">
            <span className="h-px flex-1 bg-brand-200/70" /> or use email{" "}
            <span className="h-px flex-1 bg-brand-200/70" />
          </div>

          {sent ? (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:text-brand-200">
              Check your inbox for a sign-in link. ✨
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="space-y-3">
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
                className="btn-secondary w-full disabled:opacity-60"
              >
                {loading ? "Sending…" : "Email me a secure link"}
              </button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        </div>
        <p className="mt-6 text-center text-xs text-ink-soft/70">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.45A11.97 11.97 0 0 0 1.27 6.6l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
      <path d="M16.7 12.86c.02 2.85 2.5 3.8 2.53 3.81-.02.07-.4 1.36-1.3 2.7-.79 1.15-1.6 2.3-2.89 2.32-1.26.02-1.67-.74-3.12-.74-1.44 0-1.9.72-3.09.77-1.24.05-2.18-1.25-2.97-2.4C4.24 16.97 3 12.71 4.66 9.9a4.62 4.62 0 0 1 3.9-2.37c1.22-.02 2.37.82 3.12.82.74 0 2.14-1.01 3.61-.86.62.03 2.35.25 3.46 1.88-.09.06-2.07 1.21-2.05 3.5ZM14.32 5.94c.66-.8 1.1-1.9.98-3-.95.04-2.1.63-2.78 1.43-.61.7-1.14 1.83-1 2.91 1.06.08 2.14-.54 2.8-1.34Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
      <path d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.8-4.67 4.53-4.67 1.31 0 2.69.23 2.69.23v2.96h-1.52c-1.49 0-1.95.93-1.95 1.88V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z" />
    </svg>
  );
}
