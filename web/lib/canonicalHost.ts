// www → bare domain, done in the Worker (worker/index.ts) before the app.
// The next.config redirect alone drops the query string under vinext, so a
// shared www link lost its utm_* or ?next= on the way. Pure and tested.

export const CANONICAL_HOST = "relationshipcopilot.com";
const ALIASES = new Set([`www.${CANONICAL_HOST}`]);

/** The canonical URL for an alias host (path and query kept), else null. */
export function canonicalRedirect(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (!ALIASES.has(url.hostname.toLowerCase())) return null;
  return `https://${CANONICAL_HOST}${url.pathname}${url.search}`;
}
