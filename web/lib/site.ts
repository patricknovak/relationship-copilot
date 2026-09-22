/**
 * Production origin for SEO canonicals.
 *
 * Always point rel=canonical at the live marketing host so preview / local
 * deployments (where NEXT_PUBLIC_SITE_URL may differ) do not emit alternate
 * canonical URLs that dilute indexing.
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
