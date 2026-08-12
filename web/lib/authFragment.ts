// Parse the implicit-flow auth fragment Supabase's verify endpoint appends to
// a redirect (#access_token=…&refresh_token=…). Admin-sent invite emails use
// this flow — there is no PKCE verifier in the invitee's browser — so the
// tokens arrive in the URL hash and must be consumed client-side. Pure and
// unit-tested; the session handoff lives in AuthFragmentSession.

export function parseAuthFragment(
  hash: string | null | undefined,
): { access_token: string; refresh_token: string } | null {
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}
