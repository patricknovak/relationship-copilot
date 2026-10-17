import type { ReactNode } from "react";
import Link from "next/link";
import { AUTH_HINT_SCRIPT } from "@/lib/authHint";

// Sets <html data-auth="in"> before first paint when a session cookie exists
// (lib/authHint.ts). Lets public pages be static while nav and CTAs match the
// visitor. Display only; the server still checks every protected route.
export function AuthHintScript({ nonce }: { nonce?: string }) {
  return (
    <script
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: AUTH_HINT_SCRIPT }}
    />
  );
}

// Renders both variants; CSS in globals.css shows the one matching data-auth.
// Identical markup on server and client, so no hydration mismatch.
export function AuthSwitch({
  signedIn,
  signedOut,
}: {
  signedIn: ReactNode;
  signedOut: ReactNode;
}) {
  return (
    <>
      <span className="auth-in">{signedIn}</span>
      <span className="auth-out">{signedOut}</span>
    </>
  );
}

// A link whose target (and optionally label) depends on the auth hint, e.g.
// "/connections/new" when signed in, "/login?next=/connections/new" when not.
export function AuthLink({
  signedInHref,
  signedOutHref,
  className,
  children,
  signedInChildren,
}: {
  signedInHref: string;
  signedOutHref: string;
  className?: string;
  children: ReactNode;
  signedInChildren?: ReactNode;
}) {
  return (
    <AuthSwitch
      signedIn={
        <Link href={signedInHref} className={className}>
          {signedInChildren ?? children}
        </Link>
      }
      signedOut={
        <Link href={signedOutHref} className={className}>
          {children}
        </Link>
      }
    />
  );
}
