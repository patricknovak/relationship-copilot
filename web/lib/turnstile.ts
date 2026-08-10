// Cloudflare Turnstile site-key resolution for the login form. Supabase has
// captcha protection enabled in production, so magic-link sign-in must send a
// Turnstile token. Site keys are public (they ship in the page HTML), so the
// production key is the built-in default and deploys work with no extra env
// var; NEXT_PUBLIC_TURNSTILE_SITE_KEY overrides it, and "off"/"none"/
// "disabled" hides the widget for environments whose Supabase project has
// captcha protection turned off (e.g. local dev).
const PRODUCTION_SITE_KEY = "0x4AAAAAAAEMK007CLbb2ryAl";
const DISABLED_VALUES = new Set(["off", "none", "disabled"]);

export function resolveTurnstileSiteKey(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return PRODUCTION_SITE_KEY;
  if (DISABLED_VALUES.has(value.toLowerCase())) return null;
  return value;
}
