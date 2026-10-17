/**
 * Security response headers for Relationship Copilot.
 *
 * CSP is built as a directive map so tests can assert each source and the PR
 * body can document why it is present. Prefer deriving the Supabase origin
 * from NEXT_PUBLIC_SUPABASE_URL rather than hardcoding the project ref.
 *
 * script-src uses a per-request nonce (minted in proxy.ts) instead of
 * 'unsafe-inline'. ThemeScript, ConsentDefaults, AuthHint, and the GTM
 * loader receive the nonce from layout. We intentionally omit 'strict-dynamic'
 * so same-origin Next.js chunks (including loading.tsx boundary scripts that
 * historically omitted the nonce attribute) still load via 'self'.
 */

import { cspNonceSource } from "@/lib/cspNonce";

export type CspMode = "enforce" | "report-only";

export type SecurityHeader = { key: string; value: string };

export type BuildCspDirectivesOptions = {
  /** Per-request script nonce; when set, replaces 'unsafe-inline' in script-src. */
  nonce?: string | null;
  /** Add 'unsafe-eval' for React refresh / stack reconstruction in development. */
  isDev?: boolean;
};

export type BuildSecurityHeadersOptions = {
  /** From NEXT_PUBLIC_SUPABASE_URL when available. */
  supabaseUrl?: string | null;
  /**
   * Enforced by default. Pass "report-only" only for emergency rollback.
   */
  cspMode?: CspMode;
  nonce?: string | null;
  isDev?: boolean;
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
  options: BuildCspDirectivesOptions = {},
): Record<string, string> {
  const supabase = supabaseConnectOrigins(supabaseUrl);
  const nonce = options.nonce?.trim() || null;
  const scriptSources = [
    "'self'",
    nonce ? cspNonceSource(nonce) : "'unsafe-inline'",
    "https://www.googletagmanager.com",
    "https://challenges.cloudflare.com",
  ];
  if (options.isDev) {
    scriptSources.push("'unsafe-eval'");
  }

  return {
    "default-src": "'self'",
    // Hosts: GTM container + Cloudflare Turnstile api.js.
    // Inline scripts (ThemeScript, ConsentDefaults, AuthHint, GTM loader)
    // use the per-request nonce when provided.
    "script-src": scriptSources.join(" "),
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

/**
 * HSTS, matching what Vercel sent in production before the move to
 * Cloudflare Workers (two years, no includeSubDomains, no preload), so
 * browsers see no change. Owned by the app now that the Worker is the only
 * host; widen to includeSubDomains only once every subdomain is HTTPS.
 */
export const HSTS = "max-age=63072000";

/** Non-CSP headers that are always enforced. */
export function buildEnforcedSecurityHeaders(): SecurityHeader[] {
  return [
    { key: "Strict-Transport-Security", value: HSTS },
    { key: "X-Frame-Options", value: FRAME_OPTIONS },
    { key: "X-Content-Type-Options", value: NOSNIFF },
    { key: "Referrer-Policy", value: REFERRER_POLICY },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];
}

/**
 * Full header set for Next `headers()` / middleware, HSTS included.
 */
export function buildSecurityHeaders(
  options: BuildSecurityHeadersOptions = {},
): SecurityHeader[] {
  const cspMode = options.cspMode ?? "enforce";
  const csp = formatCsp(
    buildCspDirectives(options.supabaseUrl, {
      nonce: options.nonce,
      isDev: options.isDev,
    }),
  );
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
