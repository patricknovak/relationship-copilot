/**
 * Where to send someone after a successful sign-in when they did not ask for
 * an explicit `next`. Keeps new users without a partner on the invite path
 * (create connection → share link) instead of an empty connections hub.
 */

export type PostAuthProfile = {
  display_name: string | null;
};

export type PostAuthConnection = {
  id: string;
  /** True when someone else has already joined this connection. */
  hasPartner: boolean;
};

/**
 * Resolve the post-auth path.
 * - Incomplete profile → /onboarding (optionally carrying next toward invite)
 * - No partner yet → existing solo connection invite, else /connections/new
 * - Otherwise → /connections
 */
export function postAuthPath(input: {
  profile: PostAuthProfile | null;
  connections: PostAuthConnection[];
}): string {
  if (!input.profile?.display_name?.trim()) {
    // After name setup, land on the invite step — not /account.
    return "/onboarding?next=%2Fconnections%2Fnew";
  }

  const solo = input.connections.find((c) => !c.hasPartner);
  if (solo) return `/connections/${solo.id}#invite`;
  if (input.connections.length === 0) return "/connections/new";
  return "/connections";
}
