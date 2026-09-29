/**
 * Security response headers for Relationship Copilot.
 *
 * CSP is built as a directive map so tests can assert each source and the PR
 * body can document why it is present. Prefer deriving the Supabase origin
 * from NEXT_PUBLIC_SUPABASE_URL rather than hardcoding the project ref.
 *
 * script-src uses a tight host allowlist (not nonces): wiring a nonce through
 * root layout via `headers()` would dynamize every page — including the
 * crisis /safety surface that currently stays static. Inline ThemeScript,
 * ConsentDefaults, and the GTM loader therefore need 'unsafe-inline';
 * external loaders are allowlisted by host.
 */

export type CspMode = "enforce" | "report-only";

export type SecurityHeader = { key: string; value: string };

export type BuildSecurityHeadersOptions = {
  /** From NEXT_PUBLIC_SUPABASE_URL when available. */
  supabaseUrl?: string | null;
  /**
   * Prefer report-only until a Vercel preview confirms no console violations
   * with GTM + Turnstile. Other headers are always enforced.
   */
  cspMode?: CspMode;
};

/** Permissions the app does not use — disable explicitly. */
export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
  "browsing-topics=()",
  "accelerometer=()",
  "gyroscope=()",
  "magnetometer=()",
  "midi=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "xr-spatial-tracking=()",
].join(", ");

export const FRAME_OPTIONS = "DENY";
export const NOSNIFF = "nosniff";
export const REFERRER_POLICY = "strict-origin-when-cross-origin";

/**
 * Derive https + wss origins for Supabase REST/Auth and Realtime
 * (RevealWatcher subscribes over websockets).
 */
export function supabaseConnectOrigins(
  supabaseUrl: string | null | undefined,
): string[] {
  const raw = supabaseUrl?.trim();
  if (!raw) {
    // Build-time / local without env: keep a project-agnostic fallback so
    // connect-src is not empty. Prefer the concrete origin when env is set.
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return ["https://*.supabase.co", "wss://*.supabase.co"];
    }
    const httpOrigin = url.origin;
    const wsOrigin =
      url.protocol === "https:"
        ? `wss://${url.host}`
        : `ws://${url.host}`;
    return [httpOrigin, wsOrigin];
  } catch {
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }
}

/**
 * CSP directive map. Values are space-separated source lists (no trailing ;).
 * frame-ancestors is duplicated by X-Frame-Options for older clients.
 */
export function buildCspDirectives(
  supabaseUrl?: string | null,
): Record<string, string> {
  const supabase = supabaseConnectOrigins(supabaseUrl);

  return {
    "default-src": "'self'",
    // 'unsafe-inline': ThemeScript, ConsentDefaults, GTM loader (see file header).
    // Hosts: GTM container + Cloudflare Turnstile api.js.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      "https://www.googletagmanager.com",
      "https://challenges.cloudflare.com",
    ].join(" "),
    // React inline style={{...}} attrs (animation delays, skeletons).
    // next/font self-hosts Fraunces/Inter — no fonts.googleapis.com needed.
    "style-src": ["'self'", "'unsafe-inline'"].join(" "),
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      // GA4 / GTM pixels and beacons
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://*.googletagmanager.com",
    ].join(" "),
    "font-src": ["'self'", "data:"].join(" "),
    "connect-src": [
      "'self'",
      ...supabase,
      // GTM / GA4 (incl. regional collect endpoints)
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://*.googletagmanager.com",
      // Turnstile token verification from the widget
      "https://challenges.cloudflare.com",
    ].join(" "),
    // Turnstile iframe; GTM does not use a noscript iframe in this app.
    "frame-src": ["'self'", "https://challenges.cloudflare.com"].join(" "),
    "child-src": ["'self'", "https://challenges.cloudflare.com"].join(" "),
    "worker-src": ["'self'", "blob:"].join(" "),
    "manifest-src": "'self'",
    "object-src": "'none'",
    "base-uri": "'self'",
    // Server actions post to self; Stripe Checkout/Portal are top-level redirects
    // after the action (not form targets). Allow Stripe form posts defensively.
    "form-action": [
      "'self'",
      "https://checkout.stripe.com",
      "https://billing.stripe.com",
    ].join(" "),
    "frame-ancestors": "'none'",
    // Upgrade any accidental http subresource on the apex host.
    "upgrade-insecure-requests": "",
  };
}

export function formatCsp(directives: Record<string, string>): string {
  return Object.entries(directives)
    .map(([name, value]) => (value === "" ? name : `${name} ${value}`))
    .join("; ");
}

/** Non-CSP headers that are always enforced. */
export function buildEnforcedSecurityHeaders(): SecurityHeader[] {
  return [
    { key: "X-Frame-Options", value: FRAME_OPTIONS },
    { key: "X-Content-Type-Options", value: NOSNIFF },
    { key: "Referrer-Policy", value: REFERRER_POLICY },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];
}

/**
 * Full header set for Next `headers()` / middleware.
 * Does not set Strict-Transport-Security — Vercel already sends HSTS on
 * production; we must not weaken it.
 */
export function buildSecurityHeaders(
  options: BuildSecurityHeadersOptions = {},
): SecurityHeader[] {
  const cspMode = options.cspMode ?? "report-only";
  const csp = formatCsp(buildCspDirectives(options.supabaseUrl));
  const cspHeader: SecurityHeader = {
    key:
      cspMode === "enforce"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
    value: csp,
  };
  return [...buildEnforcedSecurityHeaders(), cspHeader];
}

/** Shape expected by next.config.mjs `headers()`. */
export function toNextConfigHeaders(
  headers: SecurityHeader[],
): { key: string; value: string }[] {
  return headers.map(({ key, value }) => ({ key, value }));
}
