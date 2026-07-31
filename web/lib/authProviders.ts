// Which social sign-in buttons the login page renders, driven by the
// NEXT_PUBLIC_AUTH_PROVIDERS env var so a provider can be turned on in the
// Supabase dashboard and surfaced here without a code change.
//
// Semantics: unset (or blank) shows every button; otherwise only the
// comma-separated providers listed, unknown names ignored. To hide all social
// buttons (email-only login) set it to a non-provider value like "none".
export const OAUTH_PROVIDERS = ["google", "apple", "facebook"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function parseAuthProviders(
  raw: string | null | undefined,
): OAuthProvider[] {
  if (raw == null || raw.trim() === "") return [...OAUTH_PROVIDERS];
  const wanted = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return OAUTH_PROVIDERS.filter((p) => wanted.includes(p));
}
