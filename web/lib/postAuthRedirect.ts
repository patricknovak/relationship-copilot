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
  /**
   * connections.status. Archived (someone left, or the other account was
   * deleted) and blocked connections are closed: nothing can be started or
   * shared there, so they never decide where sign-in lands.
   */
  status?: string | null;
};

const CLOSED_STATUSES = new Set(["archived", "blocked"]);

/**
 * Resolve the post-auth path.
 * - No partner yet → existing solo connection invite, else /connections/new
 * - Otherwise → /connections
 * - Incomplete profile → /onboarding first, then on to the path above
 *
 * Only live connections count. Someone whose only connection is archived is
 * starting over, not waiting on an invite.
 */
export function postAuthPath(input: {
  profile: PostAuthProfile | null;
  connections: PostAuthConnection[];
}): string {
  const live = input.connections.filter(
    (c) => !CLOSED_STATUSES.has(c.status ?? ""),
  );
  const solo = live.find((c) => !c.hasPartner);
  const dest = solo
    ? `/connections/${solo.id}#invite`
    : live.length === 0
      ? "/connections/new"
      : "/connections";

  if (!input.profile?.display_name?.trim()) {
    // Name first, then where they were headed anyway. An invitee who joined
    // before naming themselves goes back to their connection afterwards,
    // not to "create a new connection".
    return `/onboarding?next=${encodeURIComponent(dest)}`;
  }
  return dest;
}
