/**
 * Guard so Playwright / CI never point the public e2e suite at the
 * production Supabase project (`digbnrhwsifmycrxyquo`). The core-loop suite
 * already refuses non-local URLs in e2e-core/helpers.ts; this covers the
 * public suite that previously inherited `.env.production`.
 */

export const PRODUCTION_SUPABASE_HOST = "digbnrhwsifmycrxyquo.supabase.co";

/** True when the URL host is the production Supabase project. */
export function isProductionSupabaseUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    return new URL(url).hostname === PRODUCTION_SUPABASE_HOST;
  } catch {
    return url.includes("digbnrhwsifmycrxyquo");
  }
}

/**
 * Env for the public Playwright webServer: local mock Supabase by default.
 * Callers may override with real local `supabase start` keys. Never returns
 * the production project URL.
 */
export function e2ePublicSupabaseEnv(
  env: Record<string, string | undefined> = process.env,
): {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
} {
  const url =
    env.E2E_SUPABASE_URL?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "http://127.0.0.1:54321";
  if (isProductionSupabaseUrl(url)) {
    throw new Error(
      `Refusing production Supabase URL for e2e (${PRODUCTION_SUPABASE_HOST}). ` +
        `Set E2E_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL to a local supabase start ` +
        `or mock (e.g. http://127.0.0.1:54321).`,
    );
  }
  const anon =
    env.E2E_SUPABASE_ANON_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "e2e-mock-anon-key-not-for-production";
  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  };
}
