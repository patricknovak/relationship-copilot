// How the site describes signing in, derived from the same setting that
// decides which buttons /login shows (NEXT_PUBLIC_AUTH_PROVIDERS), so turning
// a provider on or off can never leave a page saying something false.
// NEXT_PUBLIC_* is inlined at build time, so this works in client components.

import { parseAuthProviders, type OAuthProvider } from "@/lib/authProviders";

const NAMES: Record<OAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
};

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** "Google", "Google or Apple", or "a secure email link" when no provider. */
export function signInVia(raw: string | null | undefined = process.env.NEXT_PUBLIC_AUTH_PROVIDERS): string {
  const providers = parseAuthProviders(raw);
  return providers.length ? list(providers.map((p) => NAMES[p])) : "a secure email link";
}

/** The reassurance line under a join button. */
export function continueLine(raw: string | null | undefined = process.env.NEXT_PUBLIC_AUTH_PROVIDERS): string {
  const providers = parseAuthProviders(raw);
  return providers.length
    ? `Continue with ${list(providers.map((p) => NAMES[p]))} — no password to invent.`
    : "Sign in with a secure email link — no password to invent.";
}
