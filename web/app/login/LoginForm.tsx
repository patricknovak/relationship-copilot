"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/redirect";
import {
  parseAuthProviders,
  type OAuthProvider,
} from "@/lib/authProviders";
import { resolveTurnstileSiteKey } from "@/lib/turnstile";
import { AUTH_LINK_FAILED_MESSAGE } from "@/lib/authConfirm";
import {
  loginHeadline,
  loginIntentFromNext,
  loginSubhead,
  type LoginIntent,
} from "@/lib/inviteStatus";
import Turnstile from "@/components/Turnstile";

const ENABLED_PROVIDERS = parseAuthProviders(
  process.env.NEXT_PUBLIC_AUTH_PROVIDERS,
);

const TURNSTILE_SITE_KEY = resolveTurnstileSiteKey(
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
);

export default function LoginForm({
  nextPath,
  inviterName,
}: {
  /** Already validated with safeNextPath (may be empty). */
  nextPath: string;
  /** Display name only — never an ID. Null when unknown or not an invitee. */
  inviterName: string | null;
}) {
  const intent: LoginIntent = loginIntentFromNext(nextPath || null);
  const headline = loginHeadline(intent, inviterName);
  const subhead = loginSubhead(intent, inviterName);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLinkFailed, setAuthLinkFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [emailOpen, setEmailOpen] = useState(ENABLED_PROVIDERS.length === 0);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth") {
      setSent(false);
      setAuthLinkFailed(true);
      setEmailOpen(true);
      setError(AUTH_LINK_FAILED_MESSAGE);
      requestAnimationFrame(() => {
        emailInputRef.current?.focus();
      });
    }
  }, []);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          safeNextPath(nextPath || null, ""),
        )}`
      : undefined;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Please complete the verification check first.");
      return;
    }
    setLoading(true);
    setError(null);
    setAuthLinkFailed(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        captchaToken: captchaToken ?? undefined,
      },
    });
    setLoading(false);
    if (TURNSTILE_SITE_KEY) {
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    }
    if (error) setError(error.message);
    else setSent(true);
  }

  function focusResendForm() {
    setSent(false);
    setAuthLinkFailed(true);
    setEmailOpen(true);
    if (!error) setError(AUTH_LINK_FAILED_MESSAGE);
    requestAnimationFrame(() => {
      emailInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      emailInputRef.current?.focus();
    });
  }

  function sendNewLink() {
    focusResendForm();
    if (
      email.trim() &&
      (!TURNSTILE_SITE_KEY || captchaToken) &&
      formRef.current
    ) {
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    }
  }

  async function signInWith(provider: OAuthProvider) {
    setError(null);
    setAuthLinkFailed(false);
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
  }

  const googleEnabled = ENABLED_PROVIDERS.includes("google");
  const otherProviders = ENABLED_PROVIDERS.filter((p) => p !== "google");

  return (
    <div className="hero-glow">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="card !rounded-3xl !p-8 shadow-lift animate-fade-up">
          <h1 className="text-3xl">{headline}</h1>
          <p className="mt-2 text-sm text-ink-soft">{subhead}</p>

          {/* Google is the primary door until cross-device email is proven. */}
          {googleEnabled && (
            <div className="mt-6">
              <button
                onClick={() => signInWith("google")}
                disabled={oauthLoading !== null}
                className="btn-primary flex w-full items-center justify-center gap-2.5 !py-3 disabled:opacity-60"
              >
                <GoogleIcon />
                {oauthLoading === "google" ? "Connecting…" : "Continue with Google"}
              </button>
            </div>
          )}

          {otherProviders.length > 0 && (
            <div className={`space-y-2.5 ${googleEnabled ? "mt-3" : "mt-6"}`}>
              {otherProviders.includes("apple") && (
                <button
                  onClick={() => signInWith("apple")}
                  disabled={oauthLoading !== null}
                  className="flex w-full items-center justify-center gap-2.5 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-gray-900 disabled:opacity-60"
                >
                  <AppleIcon />
                  {oauthLoading === "apple" ? "Connecting…" : "Continue with Apple"}
                </button>
              )}
              {otherProviders.includes("facebook") && (
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
              )}
            </div>
          )}

          {/* Email magic link — secondary until cross-device email QA passes. */}
          {ENABLED_PROVIDERS.length > 0 ? (
            <div className="mt-6">
              {!emailOpen ? (
                <button
                  type="button"
                  onClick={() => setEmailOpen(true)}
                  className="w-full text-center text-sm text-ink-soft/80 underline-offset-2 transition hover:text-ink hover:underline"
                >
                  Or use email instead
                </button>
              ) : (
                <p className="mb-3 text-center text-xs text-ink-soft/60">
                  Or use email
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6" />
          )}

          {error && (
            <div className="mb-4 space-y-2">
              <p className="text-sm text-rose-600">{error}</p>
              {authLinkFailed && !sent && (
                <button
                  type="button"
                  onClick={sendNewLink}
                  className="text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900"
                >
                  Send a new link
                </button>
              )}
            </div>
          )}

          {emailOpen &&
            (sent ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:text-brand-200">
                  Check your inbox for a sign-in link. ✨
                </div>
                <button
                  type="button"
                  onClick={focusResendForm}
                  className="text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900"
                >
                  Send a new link
                </button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={sendMagicLink} className="space-y-3">
                <input
                  ref={emailInputRef}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input"
                  autoComplete="email"
                />
                {TURNSTILE_SITE_KEY && (
                  <Turnstile
                    key={captchaKey}
                    siteKey={TURNSTILE_SITE_KEY}
                    onToken={setCaptchaToken}
                  />
                )}
                <button
                  type="submit"
                  disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
                  className="btn-secondary w-full disabled:opacity-60"
                >
                  {loading
                    ? "Sending…"
                    : authLinkFailed
                      ? "Email me a new link"
                      : "Email me a secure link"}
                </button>
              </form>
            ))}
        </div>
        <p className="mt-6 text-center text-xs text-ink-soft/70">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
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
