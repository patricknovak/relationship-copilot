/** @type {import('next').NextConfig} */

// Security header builders live in lib/securityHeaders.ts (vitest-covered).
// next.config cannot import TypeScript, so the enforced header values are
// mirrored here and kept in lockstep with that module (see securityHeaders.test.ts).
// CSP is applied in middleware so connect-src can use request-time
// NEXT_PUBLIC_SUPABASE_URL.

const PERMISSIONS_POLICY = [
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

// Same value Vercel sent before the move to Cloudflare Workers.
const HSTS = "max-age=63072000";

const ENFORCED_HEADERS = [
  { key: "Strict-Transport-Security", value: HSTS },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
];

const nextConfig = {
  reactStrictMode: true,
  // www → apex (308). On Cloudflare Workers this is the only place the
  // redirect lives, so keep `permanent: true` (vinext ignores statusCode).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.relationshipcopilot.com" }],
        destination: "https://relationshipcopilot.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Applied to every path, static assets included. HSTS lives here now that
    // the app, not the platform, is responsible for it.
    return [
      {
        source: "/:path*",
        headers: ENFORCED_HEADERS,
      },
    ];
  },
};

export default nextConfig;
