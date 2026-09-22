/**
 * Primary production marketing origin for SEO absolute URLs.
 *
 * Host strategy (verified 2026-09-22 against live Vercel Domains):
 * - Primary: apex `https://relationshipcopilot.com`
 * - `www.relationshipcopilot.com` permanently redirects (308) to apex
 *
 * Keep CANONICAL_ORIGIN, metadataBase, sitemap, robots, and Open Graph
 * absolute URLs on this origin. Do not switch to www without also flipping
 * the platform redirect. Preview / local NEXT_PUBLIC_SITE_URL must not
 * dilute indexing via alternate canonical hosts.
 */
export const CANONICAL_ORIGIN = "https://relationshipcopilot.com";

/**
 * Absolute canonical URL for a public path.
 * No trailing slash (matches Next.js Metadata emission and default routing).
 */
export function canonicalUrl(path: string = "/"): string {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "/") {
    return CANONICAL_ORIGIN;
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const noTrailing =
    withSlash.length > 1 && withSlash.endsWith("/")
      ? withSlash.slice(0, -1)
      : withSlash;
  return `${CANONICAL_ORIGIN}${noTrailing}`;
}
