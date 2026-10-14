// Edge caching for responses that are constant but expensive to produce on
// a Worker. Today that is the two Open Graph images: vinext renders them
// (satori + resvg in WASM) on every request, ~1–2.5 s of CPU, while Vercel
// served them as static files. Pure so the cache-key rules are unit-tested.

// Social crawlers re-fetch og:image on every share. The App Router appends a
// content hash (`?8d3926ed…`) to the og:image URL, so a design change yields a
// new URL and a new cache entry; a long TTL is safe.
export const OG_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800";

/**
 * Cache key for a cacheable request, or null when the request must always go
 * to the app. Only GET, only the two OG image routes. The invite image is the
 * same for every code by design (app/invite/[code]/opengraph-image.tsx keeps
 * inviter names and codes out of unfurl caches), so all codes share one key.
 */
export function edgeCacheKey(method: string, rawUrl: string): string | null {
  if (method !== "GET") return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const hash = url.search; // the App Router's content hash, or ""
  if (url.pathname === "/opengraph-image") {
    return `${url.origin}/opengraph-image${hash}`;
  }
  if (/^\/invite\/[^/]+\/opengraph-image$/.test(url.pathname)) {
    return `${url.origin}/invite/_/opengraph-image${hash}`;
  }
  return null;
}

/** Whether an app response may be stored under an edge cache key. */
export function isCacheableResponse(status: number, contentType: string | null): boolean {
  return status === 200 && !!contentType && contentType.startsWith("image/");
}
